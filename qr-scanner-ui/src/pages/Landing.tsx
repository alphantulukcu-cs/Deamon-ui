import type { CSSProperties, SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'

interface LandingHighlight {
  title: string
  description: string
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element
}

function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 50" fill="none" aria-hidden="true" {...props}>
      <circle cx="25" cy="25" r="25" fill="#7DB900" />
      <path
        d="M16 16.5h9.3v3.2H19.2v3.7h5.5v3.1h-5.5v3.8h6.1v3.2H16V16.5Zm17.2 0a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4Zm0 2.6a6.6 6.6 0 1 1 0 13.2 6.6 6.6 0 0 1 0-13.2Zm-1.2 1.9h2.5v5.1l3.4 2.2-1.3 2.1-4.6-2.9V21Z"
        fill="#fff"
      />
    </svg>
  )
}

function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 50" fill="none" aria-hidden="true" {...props}>
      <circle cx="25" cy="25" r="25" fill="#7DB900" />
      <path
        d="M25 13.5 36.5 18v8.4c0 6.7-4.6 12.8-11.5 14.6-6.9-1.8-11.5-7.9-11.5-14.6V18L25 13.5Zm-1.5 7.1H17.7v6c0 4.6 2.7 8.9 7.3 10.8V20.6h-1.5Zm4.1 0v16.8c4.6-1.9 7.3-6.2 7.3-10.8v-6h-5.8Z"
        fill="#fff"
      />
    </svg>
  )
}

function VisibilityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 50" fill="none" aria-hidden="true" {...props}>
      <circle cx="25" cy="25" r="25" fill="#7DB900" />
      <path
        d="M16.4 14.8h17.2a2.4 2.4 0 0 1 2.4 2.4v11.5a2.4 2.4 0 0 1-2.4 2.4h-4.1l-3.8 3-3.8-3h-5.5a2.4 2.4 0 0 1-2.4-2.4V17.2a2.4 2.4 0 0 1 2.4-2.4Zm1.1 3.4v2.7h15v-2.7h-15Zm0 4.8v2.7h15V23h-15Zm8.2 9.8c-5.2 0-9.4 4.1-10.5 5.4 1.1 1.3 5.3 5.4 10.5 5.4 5.2 0 9.4-4.1 10.5-5.4-1.1-1.3-5.3-5.4-10.5-5.4Zm0 2.6a2.8 2.8 0 1 1 0 5.7 2.8 2.8 0 0 1 0-5.7Z"
        fill="#fff"
      />
    </svg>
  )
}

const HIGHLIGHTS: LandingHighlight[] = [
  {
    title: 'Hızlı Operasyon',
    description: 'Çek fotoğrafı ve QR doğrulaması tek akışta tamamlanır.',
    icon: ClockIcon,
  },
  {
    title: 'Güvenli Süreç',
    description: 'Kontroller standartlaşır, şube süreçlerinde hata riski azalır.',
    icon: ShieldIcon,
  },
  {
    title: 'Net İzlenebilirlik',
    description: 'Oturum bazlı kayıtlarda tüm adımlar görünür ve raporlanabilir.',
    icon: VisibilityIcon,
  },
]

export interface LandingProps {
  onStart?: () => void
  embedded?: boolean
}

export function Landing({ onStart, embedded = false }: LandingProps) {
  const navigate = useNavigate()
  const contentAnimationStyle: CSSProperties = { animation: 'fadeSlideUp 420ms ease-out both' }
  const buttonAnimationStyle: CSSProperties = { animation: 'fadeSlideUp 420ms ease-out 80ms both' }

  const handleStart = (): void => {
    if (onStart) {
      onStart()
      return
    }

    navigate('/home')
  }

  const WrapperTag = embedded ? 'section' : 'main'
  const shellClass = embedded
    ? 'flex min-h-[calc(100vh-7rem)] flex-col bg-white text-[#4B4F54]'
    : 'flex min-h-dvh flex-col bg-white text-[#4B4F54]'

  return (
    <WrapperTag className={shellClass}>
      <style>
        {`@keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }`}
      </style>
      <div className="mx-auto flex w-full max-w-[402px] flex-1 flex-col bg-white">
        <div className="flex flex-1 flex-col">
          <section
            style={contentAnimationStyle}
            className="border-t-2 border-[#7DB900] px-4 pb-6 pt-7 text-center"
          >
            <p className="text-[18px] font-semibold leading-[22px] text-[#007A3D]">
              Şube Operasyonları İçin Yeni Nesil Yardımcı
            </p>
            <h1 className="mt-[18px] text-[32px] font-semibold leading-[36px] tracking-[-0.02em] text-[#4B4F54]">
              İstihbarat Sistemi ile
              <span className="block text-[#007A3D]">Çek Süreçlerini Hızlandırın</span>
            </h1>
          </section>

          <div className="h-[200px] shrink-0 overflow-hidden">
            <img
              src="/hero-seker.png"
              alt="Çek tarama görseli"
              className="h-full w-full object-cover"
            />
          </div>

          <section className="px-[14px] pt-5 text-center">
            <p className="text-[14px] font-normal leading-[22px] text-[#4B4F54]">
              Çek yakalama, QR okuma ve doğrulama adımlarını tek bir akışta birleştirerek
              operasyonu daha hızlı, daha güvenli ve daha ölçülebilir hale getirin.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-[10px]">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon

                return (
                  <article key={item.title} className="flex flex-col items-center text-center">
                    <Icon className="h-[50px] w-[50px]" />
                    <h2 className="mt-3 text-[16px] font-bold leading-[22px] text-[#4B4F54]">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-[14px] leading-[20px] text-[#4B4F54]">
                      {item.description}
                    </p>
                  </article>
                )
              })}
            </div>
          </section>

          <div className="mt-auto flex flex-col items-center px-4 pb-8 pt-10">
            <button
              type="button"
              onClick={handleStart}
              style={buttonAnimationStyle}
              className="h-[50px] w-[200px] rounded-[25px] bg-[#007A3D] text-[20px] font-normal leading-[22px] text-[#F3F3F3] transition-colors hover:bg-[#018342]"
            >
              Hemen Başla
            </button>
          </div>
        </div>
      </div>
    </WrapperTag>
  )
}

export default Landing
