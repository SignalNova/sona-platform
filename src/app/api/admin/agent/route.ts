import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { ALL_TOOLS, getToolsByCategory, executeTool, TOOL_MAP } from '@/lib/admin-agent-tools'
import { logIntrusionEvent } from '@/lib/security'
import { db } from '@/lib/db'

// AI Admin Agent - Chat with tool execution
// SECURITY: Only JWT/Cookie authentication allowed - NO body-based userId fallback
export async function POST(request: NextRequest) {
  try {
    // ── VERIFY ADMIN AUTHENTICATION (JWT/Cookie ONLY) ──
    const authUser = await getAuthUser(request)
    if (!authUser) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      logIntrusionEvent(ip, 'UNAUTHORIZED_ADMIN_ACCESS', '/api/admin/agent', 'No valid authentication token provided')
      return NextResponse.json({ error: 'غير مصرح - يتطلب تسجيل دخول المشرف' }, { status: 401 })
    }

    if (String(authUser.role).toLowerCase() !== 'admin') {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      logIntrusionEvent(ip, 'UNAUTHORIZED_ADMIN_ACCESS', '/api/admin/agent', `Non-admin user ${authUser.email} attempted admin agent access`)
      return NextResponse.json({ error: 'غير مصرح - صلاحيات المشرف مطلوبة' }, { status: 403 })
    }

    if (!authUser.isActive) {
      return NextResponse.json({ error: 'حساب المشرف معطل' }, { status: 403 })
    }

    const body = await request.json()
    const { message, autoExecute } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 })
    }

    // Validate message length (prevent extremely long inputs)
    if (message.length > 5000) {
      return NextResponse.json({ error: 'الرسالة طويلة جداً. الحد الأقصى 5000 حرف.' }, { status: 400 })
    }

    // Build tool descriptions for AI
    const toolsByCategory = getToolsByCategory()
    let toolDescriptions = ''
    for (const [category, tools] of Object.entries(toolsByCategory)) {
      toolDescriptions += `\n[${category}]\n`
      for (const tool of tools as any[]) {
        const params = tool.parameters.map((p: any) => `${p.name}${p.required ? '*' : ''}:${p.type}`).join(', ')
        toolDescriptions += `- ${tool.name}(${params}): ${tool.description}${tool.requiresConfirmation ? ' [يحتاج تأكيد]' : ''}\n`
      }
    }

    // Get current system context
    const [userCount, activeInvestments, pendingDeposits, pendingWithdrawals, pendingKyc] = await Promise.all([
      db.user.count(),
      db.investment.count({ where: { status: 'ACTIVE' } }),
      db.transaction.count({ where: { type: 'DEPOSIT', status: 'PENDING' } }),
      db.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
      db.user.count({ where: { kycStatus: 'PENDING' } }),
    ])

    const systemPrompt = `أنت الوكيل الإداري الذكي لمنصة SONA الاستثمارية. أنت تتحدث بالعربية. يمكنك تنفيذ أي إجراء إداري باستخدام الأدوات المتاحة.

═══ حالة النظام الحالية ═══
- المستخدمون: ${userCount}
- الاستثمارات النشطة: ${activeInvestments}
- إيداعات معلقة: ${pendingDeposits}
- سحوبات معلقة: ${pendingWithdrawals}
- توثيقات معلقة: ${pendingKyc}

═══ الأدوات المتاحة (${ALL_TOOLS.length} أداة) ═══
${toolDescriptions}

═══ قواعد الرد ═══
1. أجب بالعربية دائماً
2. إذا طلب المستخدم إجراءً، حدد الأداة المناسبة واطلب التأكيد إذا لزم
3. إذا كان الطلب بسيطاً (استعلام)، نفذه مباشرة بدون تأكيد
4. أظهر النتائج بتنسيق واضح
5. للأدوات التي تحتاج تأكيد، اعرض التفاصيل أولاً واسأل "هل تريد المتابعة؟"
6. لا تنفذ عمليات خطرة بدون تأكيد صريح
7. إذا طلب إجراءً غير متوفر، اشرح البدائل المتاحة
8. كن سريعاً ودقيقاً في ردودك

صيغة استدعاء الأداة:
TOOL_CALL:{"name":"اسم_الأداة","params":{المعاملات}}

مثال:
TOOL_CALL:{"name":"list_users","params":{"search":"أحمد","limit":10}}

يمكنك استدعاء أداة واحدة فقط في كل رد. بعد استدعاء الأداة، ستظهر لك النتائج ويمكنك التعليق عليها.`

    // Call AI
    let aiResponse: string
    let toolCalls: Array<{ name: string; params: any; result: any }> = []

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      })

      aiResponse = completion.choices?.[0]?.message?.content || 'لم أتمكن من معالجة طلبك'

      // Parse and execute tool calls
      const toolCallRegex = /TOOL_CALL:\s*(\{[\s\S]*?\})\s*(?=\n|$|TOOL_CALL:)/g
      let match
      const maxToolCalls = autoExecute ? 5 : 1

      while ((match = toolCallRegex.exec(aiResponse)) !== null && toolCalls.length < maxToolCalls) {
        try {
          // Clean up the JSON string before parsing
          const jsonStr = match[1].trim()
          const toolCall = JSON.parse(jsonStr)
          const tool = TOOL_MAP.get(toolCall.name)

          if (!tool) {
            toolCalls.push({ name: toolCall.name, params: toolCall.params, result: { success: false, error: 'أداة غير معروفة' } })
            continue
          }

          // Check if tool needs confirmation and auto-execute is not enabled
          if (tool.requiresConfirmation && !autoExecute) {
            toolCalls.push({ name: toolCall.name, params: toolCall.params, result: { success: false, error: 'هذه الأداة تحتاج تأكيد. أرسل autoExecute: true أو أكد يدوياً.' } })
            continue
          }

          const result = await executeTool(toolCall.name, toolCall.params || {})
          toolCalls.push({ name: toolCall.name, params: toolCall.params, result })

          // Log the action with admin identity
          await db.platformLog.create({
            data: {
              action: `AGENT_TOOL_${toolCall.name}`,
              details: JSON.stringify({ adminEmail: authUser.email, params: toolCall.params, result: { success: result.success } }),
            },
          })
        } catch (parseErr) {
          // Skip malformed tool calls
        }
      }

      // If there were tool calls, get a follow-up response from AI with the results
      if (toolCalls.length > 0) {
        const toolResults = toolCalls.map(tc =>
          `أداة: ${tc.name}\nالمعاملات: ${JSON.stringify(tc.params)}\nالنتيجة: ${JSON.stringify(tc.result)}`
        ).join('\n\n')

        const followUp = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'أنت وكيل إداري ذكي. لقد نفذت الأدوات التالية. اشرح النتائج للمستخدم بالعربية بتنسيق واضح ومفيد.' },
            { role: 'user', content: `الطلب الأصلي: ${message}\n\nنتائج الأدوات:\n${toolResults}` },
          ],
          temperature: 0.3,
          max_tokens: 800,
        })

        const followUpText = followUp.choices?.[0]?.message?.content || ''
        if (followUpText) {
          aiResponse = followUpText
        }
      }
    } catch (aiErr) {
      console.error('[ADMIN-AGENT] AI Error:', aiErr)
      aiResponse = 'عذراً، واجهت مشكلة تقنية. حاول مرة أخرى.'
    }

    // Log the conversation with admin identity
    await db.platformLog.create({
      data: {
        action: 'AGENT_CHAT',
        details: JSON.stringify({ adminEmail: authUser.email, message: message.substring(0, 200), toolCalls: toolCalls.length }),
      },
    })

    return NextResponse.json({
      response: aiResponse,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      availableTools: ALL_TOOLS.length,
    })
  } catch (error) {
    console.error('[ADMIN-AGENT] Error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// GET: List available tools (admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || String(authUser.role).toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const toolsByCategory = getToolsByCategory()
    const toolList = ALL_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      parameters: t.parameters,
      requiresConfirmation: t.requiresConfirmation || false,
    }))

    return NextResponse.json({
      totalTools: ALL_TOOLS.length,
      categories: Object.keys(toolsByCategory),
      tools: toolList,
    })
  } catch (error) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
}
