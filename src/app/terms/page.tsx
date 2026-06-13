import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'شروط الاستخدام | Sona',
  description: 'شروط وأحكام استخدام منصة Sona الاستثمارية',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-20 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-[#C05BDD]">شروط الاستخدام</h1>
        <div className="prose prose-invert max-w-none space-y-6 text-gray-300 leading-relaxed">
          <p className="text-sm text-gray-500">آخر تحديث: مايو 2024</p>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. مقدمة</h2>
            <p>مرحباً بكم في منصة Sona الاستثمارية. من خلال استخدامك لهذه المنصة، فإنك توافق على الالتزام بشروط الاستخدام التالية. تُدار المنصة بواسطة Sona Investment Ltd.، الشركة المسجلة في جناح 405، برج المالية، كينغستاون، ومرخصة من لجنة الخدمات المالية (FSC) بموجب ترخيص رقم FSC-2024-0892.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. التعريفات</h2>
            <p>«المنصة» تعني موقع sonaghali.com وجميع الخدمات المرتبطة به. «المستخدم» يعني أي شخص يقوم بإنشاء حساب على المنصة. «الاستثمار» يعني وضع الأموال في إحدى باقات الاستثمار المتاحة على المنصة.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. الأهلية</h2>
            <p>يجب أن يكون عمرك 18 عاماً أو أكثر لاستخدام المنصة. يجب عليك تقديم معلومات صحيحة ودقيقة عند التسجيل، بما في ذلك التحقق من الهوية وفقاً لسياسة اعرف عميلك (KYC). يُحظر استخدام المنصة من قبل الأشخاص الممنوعين بموجب القوانين المحلية.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. الخدمات الاستثمارية</h2>
            <p>توفر المنصة خدمات إدارة أصول احترافية من خلال باقات استثمارية متنوعة. العوائد الاستثمارية ليست مضمونة وقد تتفاوت بناءً على ظروف السوق. يتم توزيع الأرباح يومياً وفقاً لنسبة العائد المحددة لكل باقة. تحتفظ المنصة بالحق في تعديل نسب العائد بعد إشعار مسبق.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. الإيداع والسحب</h2>
            <p>يتم قبول الإيداعات عبر العملات الرقمية (USDT BEP20 و TRC20). الحد الأدنى للإيداع هو 30 دولار أمريكي. تتم معالجة طلبات السحب خلال 24-48 ساعة عمل. قد تخضع العمليات لرسوم شبكةBlockchain. تحتفظ المنصة بالحق في طلب وثائق إضافية للتحقق من الهوية قبل معالجة السحوبات.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">6. المخاطر</h2>
            <p>الاستثمار في الأصول الرقمية ينطوي على مخاطر عالية. قد تخسر جزءاً أو كل رأس مالك المستثمر. الأداء السابق لا يضمن النتائج المستقبلية. يجب عليك استثمار ما يمكنك تحمل خسارته فقط. ننصح بالتشاور مع مستشار مالي محترف قبل اتخاذ قرارات الاستثمار.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">7. الخصوصية</h2>
            <p>نلتزم بحماية بياناتك الشخصية وفقاً لسياسة الخصوصية الخاصة بنا. نستخدم بياناتك فقط لتقديم الخدمات المطلوبة والامتثال للمتطلبات التنظيمية. لن نشارك بياناتك مع أطراف ثالثة دون موافقتك إلا كما هو مطلوب قانونياً.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">8. معلومات الشركة</h2>
            <div className="bg-[#1F2634] p-6 rounded-xl border border-gray-800">
              <p><strong>الشركة:</strong> Sona Investment Ltd.</p>
              <p><strong>الترخيص:</strong> FSC-2024-0892</p>
              <p><strong>الجهة الرقابية:</strong> لجنة الخدمات المالية (FSC)</p>
              <p><strong>العنوان:</strong> جناح 405، برج المالية، كينغستاون</p>
              <p><strong>الموقع:</strong> sonaghali.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
