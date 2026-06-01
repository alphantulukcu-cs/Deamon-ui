import { CheckCircle2 } from 'lucide-react'
import { useId, useState } from 'react'

export interface StartConsentStepProps {
  onContinue: () => void
  onBack?: () => void
  customerNationalId?: string
  customerEmail?: string
  inviteExpiresAtText?: string
}

export function StartConsentStep({
  onContinue,
  onBack,
  customerNationalId,
  customerEmail,
  inviteExpiresAtText,
}: StartConsentStepProps) {
  const [imageProcessingConsent, setImageProcessingConsent] = useState(false)
  const [submitTransferConsent, setSubmitTransferConsent] = useState(false)
  const [anonymizedAnalyticsConsent, setAnonymizedAnalyticsConsent] = useState(false)

  const imageProcessingId = useId()
  const submitTransferId = useId()
  const anonymizedAnalyticsId = useId()

  const canContinue = imageProcessingConsent && submitTransferConsent

  const handleContinue = (): void => {
    if (!canContinue) {
      return
    }

    onContinue()
  }

  return (
    <section className="w-full bg-white px-[10px] py-6">
      <div className="bg-white">
        {customerNationalId || customerEmail || inviteExpiresAtText ? (
          <div>
            <h2 className="text-[20px] font-bold leading-[22px] text-[#4B4F54]">
              Davet Bilgisi:
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-[16px] leading-[22px] text-[#4B4F54]">Davet Onaylandı</p>
              <CheckCircle2 className="h-5 w-5 text-[#7DB900]" aria-hidden="true" />
            </div>

            <div className="mt-4 space-y-1 text-[#4B4F54]">
              {customerNationalId ? (
                <p className="text-[16px] leading-[22px]">
                  <span className="font-semibold">Müşteri TC:</span>{' '}
                  <span className="text-[14px] font-normal">{customerNationalId}</span>
                </p>
              ) : null}
              {customerEmail ? (
                <p className="text-[16px] leading-[22px]">
                  <span className="font-semibold">Müşteri Email:</span>{' '}
                  <span className="text-[14px] font-normal">{customerEmail}</span>
                </p>
              ) : null}
              {inviteExpiresAtText ? (
                <p className="text-[16px] leading-[22px]">
                  <span className="font-semibold">Link Geçerlilik Tarihi:</span>{' '}
                  <span className="text-[14px] font-normal">{inviteExpiresAtText}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-10">
          <h2 className="text-[20px] font-bold leading-[22px] text-[#4B4F54]">
            KVKK ve Açık Rıza Onayı
          </h2>
          <p className="mt-5 text-[13px] leading-[22px] text-[#ACAEB1]">
            Çek tarama ve şubeye gönderim sürecine devam etmek için aşağıdaki onaylar gereklidir.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label
            htmlFor={imageProcessingId}
            className="flex cursor-pointer items-start gap-[10px]"
          >
            <input
              id={imageProcessingId}
              type="checkbox"
              checked={imageProcessingConsent}
              onChange={(event) => setImageProcessingConsent(event.target.checked)}
              className="mt-1 h-5 w-5 rounded-[3px] border border-[#007A3D] text-[#007A3D] focus:ring-[#7DB900]"
            />
            <div className="flex-1">
              <p className="text-[14px] leading-[22px] text-[#4B4F54]">
                <span className="mr-1 text-[#D33C3C]">*</span>
                Çek görüntüsü ve QR verisinin doğrulama amacıyla işlenmesini kabul ediyorum.
              </p>
              <p className="mt-1 text-[12px] leading-[18px] text-[#ACAEB1]">
                Veriler, çek bilgisini doğrulamak ve işlem güvenliğini sağlamak için kullanılır.
              </p>
            </div>
          </label>

          <label
            htmlFor={submitTransferId}
            className="flex cursor-pointer items-start gap-[10px]"
          >
            <input
              id={submitTransferId}
              type="checkbox"
              checked={submitTransferConsent}
              onChange={(event) => setSubmitTransferConsent(event.target.checked)}
              className="mt-1 h-5 w-5 rounded-[3px] border border-[#007A3D] text-[#007A3D] focus:ring-[#7DB900]"
            />
            <div className="flex-1">
              <p className="text-[14px] leading-[22px] text-[#4B4F54]">
                <span className="mr-1 text-[#D33C3C]">*</span>
                Taranan çek görüntülerinin ve metadata bilgisinin şube ekranına iletilmesini kabul
                ediyorum.
              </p>
              <p className="mt-1 text-[12px] leading-[18px] text-[#ACAEB1]">
                Gönderim tamamlandığında link pasif olur ve aynı oturum tekrar gönderilemez.
              </p>
            </div>
          </label>

          <label
            htmlFor={anonymizedAnalyticsId}
            className="flex cursor-pointer items-start gap-[10px]"
          >
            <input
              id={anonymizedAnalyticsId}
              type="checkbox"
              checked={anonymizedAnalyticsConsent}
              onChange={(event) => setAnonymizedAnalyticsConsent(event.target.checked)}
              className="mt-1 h-5 w-5 rounded-[3px] border border-[#007A3D] text-[#007A3D] focus:ring-[#7DB900]"
            />
            <div className="flex-1">
              <p className="text-[14px] leading-[22px] text-[#4B4F54]">
                Anonimleştirilmiş süreç verilerinin hizmet geliştirme amacıyla kullanılmasını kabul
                ediyorum.
              </p>
              <p className="mt-1 text-[12px] leading-[18px] text-[#ACAEB1]">
                Bu onay verilmezse sadece zorunlu doğrulama ve gönderim işlemleri uygulanır.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-12 flex flex-col items-center gap-5">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className={`flex h-[50px] w-[200px] items-center justify-center rounded-[25px] text-[20px] font-normal leading-[22px] text-white transition-colors ${
              canContinue
                ? 'bg-[#007A3D] hover:bg-[#018342]'
                : 'cursor-not-allowed bg-[#A5A7AA]'
            }`}
          >
            Onayla ve Devam Et
          </button>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-[50px] w-[200px] items-center justify-center rounded-[25px] border border-[#007A3D] bg-white text-[20px] font-normal leading-[22px] text-[#1E1E1E] transition-colors hover:bg-[#F3F8F5]"
            >
              Geri Dön
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default StartConsentStep
