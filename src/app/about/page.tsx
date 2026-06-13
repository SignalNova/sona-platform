import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'عن الشركة | Sona',
  description: 'تعرف على منصة Sona الاستثمارية ورؤيتنا وقيادتنا',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-20 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-[#C05BDD]">عن Sona</h1>
        <div className="prose prose-invert max-w-none space-y-6 text-gray-300 leading-relaxed">
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">من نحن</h2>
            <p>Sona هي منصة استثمارية متطورة تجمع بين تقنيات الذكاء الاصطناعي وخبرة إدارة الأصول الاحترافية لتقديم عوائد مميزة للمستثمرين. نحن نؤمن بأن الاستثمار الذكي يجب أن يكون متاحاً للجميع، ولذلك صممنا منصتنا لتكون سهلة الاستخدام مع ضمان أعلى معايير الأمان والشفافية.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">رؤيتنا</h2>
            <p>نسعى لأن نكون المنصة الاستثمارية الرائدة في المنطقة العربية، تقدم حلولاً استثمارية مبتكرة تجمع بين التكنولوجيا المتقدمة والخبرة المالية العميقة. نهدف إلى تمكين ملايين المستثمرين من تحقيق أهدافهم المالية من خلال أدوات ذكية ومحافظ متنوعة.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">تقنياتنا</h2>
            <p>نستخدم أحدث تقنيات الذكاء الاصطناعي والتعلم الآلي لتحليل الأسواق المالية واتخاذ قرارات استثمارية مدروسة. تعمل بوتات التداول الآلية لدينا على مدار الساعة لتحقيق أفضل العوائد. كما نعتمد على تقنيات البلوكتشين لضمان شفافية المعاملات وأمانها.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">معلومات الشركة</h2>
            <div className="bg-[#1F2634] p-6 rounded-xl border border-gray-800 space-y-3">
              <p><strong>الاسم القانوني:</strong> Sona Investment Ltd.</p>
              <p><strong>الترخيص:</strong> FSC-2024-0892</p>
              <p><strong>الجهة الرقابية:</strong> لجنة الخدمات المالية (FSC)</p>
              <p><strong>العنوان:</strong> جناح 405، برج المالية، كينغستاون</p>
              <p><strong>الموقع الإلكتروني:</strong> sonaghali.com</p>
              <p><strong>البريد الإلكتروني:</strong> support@sonaghali.com</p>
            </div>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-white mt-8 mb-4">الأمان والحماية</h2>
            <p>نولي الأمان أهمية قصوى في منصتنا. نستخدم تشفير AES-256 لحماية البيانات الحساسة، وبروتوكولات SSL/TLS لتأمين الاتصالات. يتم مراقبة المنصة على مدار الساعة من قبل فريق أمني متخصص وأنظمة كشف التسلل المتقدمة. كما نطبق سياسة التحقق من الهوية (KYC) لضمان هوية كل مستخدم.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
