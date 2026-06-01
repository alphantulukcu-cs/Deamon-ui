import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useEdgeDetection } from '../../hooks/useEdgeDetection'
import { useImageProcessing } from '../../hooks/useImageProcessing'
import { useQrDecoder } from '../../hooks/useQrDecoder'
import { analyzeUploadedChequeDraftBatch } from '../../services/multiChequeAnalyzer'
import { analyzeUploadedCheckImage } from '../../services/uploadedCheckAnalyzer'
import { useScannerCamera } from '../../hooks/useScannerCamera'
import type {
  CaptureDraft,
  CornerQuad,
  EnhancementMode,
  ProcessedCapture,
} from '../../types/scanner'
import { createGuideCorners, quadEdgeLengths } from '../../utils/scanner/geometry'
import AdjustScreen from './AdjustScreen'
import ScannerView from './ScannerView'

const DETECTION_WIDTH = 640
const MIN_CAPTURE_EDGE_RATIO = 0.92
const DEFAULT_MODE: EnhancementMode = 'enhanced'

type CaptureState = 'loading' | 'scanning' | 'editing' | 'adjusting' | 'error'

interface DraftItem {
  id: string
  draft: CaptureDraft
  processed: ProcessedCapture
  qrValue: string | null
  enhancementMode: EnhancementMode
}

export interface CameraCaptureProps {
  onCapture: (
    dataUrl: string,
    qrValue?: string,
    originalDataUrl?: string,
    enhancementMode?: EnhancementMode,
  ) => void
  onCaptureMultiple?: (
    items: Array<{
      dataUrl: string
      qrValue: string
      originalDataUrl?: string
      enhancementMode?: EnhancementMode
    }>,
  ) => void
  onError?: (error: string) => void
  instructionText?: string
  showOverlay?: boolean
  qrRequired?: boolean
}

function resolveCaptureErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Fotoğraf alınamadı. Lütfen tekrar deneyin.'
}

function createDraftId(): string {
  return crypto.randomUUID()
}

export function CameraCapture({
  onCapture,
  onCaptureMultiple,
  onError,
  instructionText,
  showOverlay = true,
  qrRequired = true,
}: CameraCaptureProps) {
  const documentMode = showOverlay
  const shouldRequireQr = documentMode && qrRequired

  const [captureState, setCaptureState] = useState<CaptureState>('loading')
  const [captureDraft, setCaptureDraft] = useState<CaptureDraft | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [liveQrValue, setLiveQrValue] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const capturePendingRef = useRef(false)
  const localCornersRef = useRef<CornerQuad | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadAnalyzing, setIsUploadAnalyzing] = useState(false)

  const {
    videoRef,
    setVideoRef,
    devices,
    activeDeviceId,
    switchCamera,
    restartCamera,
    error: cameraError,
    isReady,
    torchSupported,
    torchEnabled,
    torchBusy,
    flashMode,
    flashModeOptions,
    applyFlashMode,
    toggleTorch,
  } = useScannerCamera()

  const {
    corners,
    isDetecting,
    isStable,
    workerReady,
    workerEngine,
    reset: resetDetection,
  } = useEdgeDetection(videoRef, isReady, documentMode)

  const { createCaptureDraft, processCapturedFrame, isProcessing } = useImageProcessing(videoRef)

  const videoElement = videoRef.current
  const videoWidth = videoElement?.videoWidth || 1920
  const videoHeight = videoElement?.videoHeight || 1080
  const detectionHeight = Math.round(DETECTION_WIDTH * (videoHeight / videoWidth))

  const guideCorners = useMemo(
    () => createGuideCorners(DETECTION_WIDTH, detectionHeight),
    [detectionHeight],
  )

  const selectedDraft = useMemo(
    () => drafts.find((item) => item.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId],
  )

  const guideEdges = documentMode ? quadEdgeLengths(guideCorners) : null
  const detectedEdges = documentMode && corners ? quadEdgeLengths(corners) : null
  const isOrientationReady = true
  const isCloseEnough = Boolean(
    !documentMode ||
      (detectedEdges &&
        guideEdges &&
        detectedEdges.top >= guideEdges.top * MIN_CAPTURE_EDGE_RATIO &&
        detectedEdges.bottom >= guideEdges.bottom * MIN_CAPTURE_EDGE_RATIO &&
        detectedEdges.left >= guideEdges.left * MIN_CAPTURE_EDGE_RATIO &&
        detectedEdges.right >= guideEdges.right * MIN_CAPTURE_EDGE_RATIO),
  )
  const needsToMoveCloser =
    documentMode && isOrientationReady && Boolean(corners) && !isCloseEnough
  const orientationPrompt = null

  const canCapture =
    captureState === 'scanning' &&
    !isProcessing &&
    (documentMode
      ? isStable &&
        !orientationPrompt &&
        !needsToMoveCloser &&
        (!shouldRequireQr || Boolean(liveQrValue))
      : isReady)

  useQrDecoder({
    videoRef,
    canvasRef: qrCanvasRef,
    enabled:
      shouldRequireQr &&
      captureState === 'scanning' &&
      isReady &&
      liveQrValue === null,
    onDetected: (value: string) => {
      setLiveQrValue(value)
      if (
        typeof navigator !== 'undefined' &&
        'vibrate' in navigator &&
        typeof navigator.vibrate === 'function'
      ) {
        navigator.vibrate(160)
      }
    },
  })

  useEffect(() => {
    if (captureState === 'loading') {
      if (documentMode) {
        if (isReady && workerReady) {
          setCaptureState('scanning')
        }
        return
      }

      if (isReady) {
        setCaptureState('scanning')
      }
    }
  }, [captureState, documentMode, isReady, workerReady])

  useEffect(() => {
    if (!cameraError) {
      return
    }

    setCaptureState('error')
    setCaptureError(cameraError.message)
    onError?.(cameraError.message)
  }, [cameraError, onError])

  useEffect(() => {
    if (corners) {
      localCornersRef.current = corners
    }
  }, [corners])

  const resetScannerForNextCapture = useCallback((): void => {
    capturePendingRef.current = false
    setCaptureError(null)
    setLiveQrValue(null)
    localCornersRef.current = null
    resetDetection()
    setCaptureState('scanning')
  }, [resetDetection])

  const appendDraft = useCallback((nextDraft: DraftItem): void => {
    setDrafts((previous) => [...previous, nextDraft])
    setSelectedDraftId(nextDraft.id)
  }, [])

  const updateDraft = useCallback((draftId: string, updater: (draft: DraftItem) => DraftItem): void => {
    setDrafts((previous) => previous.map((draft) => (draft.id === draftId ? updater(draft) : draft)))
  }, [])

  const handleCapture = useCallback(async (): Promise<void> => {
    if (!canCapture || capturePendingRef.current) {
      return
    }

    if (shouldRequireQr && !liveQrValue) {
      const message = 'QR kod okunmadan çekim yapılamaz.'
      setCaptureError(message)
      onError?.(message)
      return
    }

    capturePendingRef.current = true
    setCaptureError(null)

    try {
      const currentCorners = localCornersRef.current ?? guideCorners
      const draft = createCaptureDraft(currentCorners, DETECTION_WIDTH, detectionHeight)
      const processed = await processCapturedFrame(draft.sourceCanvas, draft.corners, DEFAULT_MODE)

      appendDraft({
        id: createDraftId(),
        draft,
        processed,
        qrValue: liveQrValue?.trim() ?? null,
        enhancementMode: DEFAULT_MODE,
      })

      resetScannerForNextCapture()
    } catch (error: unknown) {
      capturePendingRef.current = false
      const message = resolveCaptureErrorMessage(error)
      setCaptureError(message)
      onError?.(message)
    }
  }, [
    appendDraft,
    canCapture,
    createCaptureDraft,
    detectionHeight,
    guideCorners,
    liveQrValue,
    onError,
    processCapturedFrame,
    resetScannerForNextCapture,
    shouldRequireQr,
  ])

  const handleOpenDraft = useCallback((draftId: string): void => {
    setSelectedDraftId(draftId)
    setCaptureError(null)
    setCaptureState('editing')
  }, [])

  const handleChangeDraftMode = useCallback(
    async (mode: EnhancementMode): Promise<void> => {
      if (!selectedDraft) {
        return
      }

      try {
        setCaptureError(null)
        const processed = await processCapturedFrame(
          selectedDraft.draft.sourceCanvas,
          selectedDraft.draft.corners,
          mode,
        )

        updateDraft(selectedDraft.id, (draft) => ({
          ...draft,
          processed,
          enhancementMode: mode,
        }))
      } catch (error: unknown) {
        const message = resolveCaptureErrorMessage(error)
        setCaptureError(message)
        onError?.(message)
      }
    },
    [onError, processCapturedFrame, selectedDraft, updateDraft],
  )

  const handleBeginAdjustDraft = useCallback((): void => {
    if (!selectedDraft) {
      return
    }

    setCaptureDraft(selectedDraft.draft)
    setCaptureError(null)
    setCaptureState('adjusting')
  }, [selectedDraft])

  const handleConfirmAdjustment = useCallback(
    async (adjustedCorners: CornerQuad): Promise<void> => {
      if (!selectedDraft) {
        return
      }

      try {
        const processed = await processCapturedFrame(
          selectedDraft.draft.sourceCanvas,
          adjustedCorners,
          selectedDraft.enhancementMode,
        )

        updateDraft(selectedDraft.id, (draft) => ({
          ...draft,
          draft: {
            ...draft.draft,
            corners: adjustedCorners,
          },
          processed,
        }))

        setCaptureDraft(null)
        setCaptureState('editing')
      } catch (error: unknown) {
        const message = resolveCaptureErrorMessage(error)
        setCaptureError(message)
        onError?.(message)
      }
    },
    [onError, processCapturedFrame, selectedDraft, updateDraft],
  )

  const handleDeleteSelectedDraft = useCallback((): void => {
    if (!selectedDraft) {
      return
    }

    setDrafts((previous) => previous.filter((draft) => draft.id !== selectedDraft.id))
    setSelectedDraftId((previousId) => {
      if (previousId !== selectedDraft.id) {
        return previousId
      }

      const remaining = drafts.filter((draft) => draft.id !== selectedDraft.id)
      return remaining[0]?.id ?? null
    })
    setCaptureState(drafts.length <= 1 ? 'scanning' : 'editing')
  }, [drafts, selectedDraft])

  const handleFinalizeSession = useCallback((): void => {
    if (drafts.length === 0) {
      return
    }

    const items = drafts
      .filter((draft) => !shouldRequireQr || Boolean(draft.qrValue))
      .map((draft) => ({
        dataUrl: draft.processed.dataURL,
        qrValue: draft.qrValue ?? '',
        originalDataUrl: draft.processed.originalDataURL,
        enhancementMode: draft.enhancementMode,
      }))

    if (items.length === 0) {
      const message = 'En az bir geçerli çek olmadan devam edilemez.'
      setCaptureError(message)
      onError?.(message)
      return
    }

    if (items.length === 1 || !onCaptureMultiple) {
      const first = items[0]
      onCapture(
        first.dataUrl,
        first.qrValue,
        first.originalDataUrl,
        first.enhancementMode,
      )
      return
    }

    onCaptureMultiple(items)
  }, [drafts, onCapture, onCaptureMultiple, onError, shouldRequireQr])

  const handleRetryCamera = useCallback((): void => {
    setCaptureError(null)
    setCaptureState('loading')
    void restartCamera().catch((error: unknown) => {
      const message = resolveCaptureErrorMessage(error)
      setCaptureError(message)
      onError?.(message)
      setCaptureState('error')
    })
  }, [onError, restartCamera])

  const handlePickImage = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const createDraftItem = useCallback(
    async (
      draft: CaptureDraft,
      qrValue: string | null,
      mode: EnhancementMode = DEFAULT_MODE,
    ): Promise<DraftItem> => {
      const processed = await processCapturedFrame(draft.sourceCanvas, draft.corners, mode)
      return {
        id: createDraftId(),
        draft,
        processed,
        qrValue,
        enhancementMode: mode,
      }
    },
    [processCapturedFrame],
  )

  const handleFileUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0]
      event.target.value = ''

      if (!file) {
        return
      }

      if (!file.type.startsWith('image/')) {
        const message = 'Lutfen gecerli bir resim dosyasi yukleyin.'
        setCaptureError(message)
        onError?.(message)
        return
      }

      setIsUploadAnalyzing(true)
      setCaptureError(null)

      try {
        if (onCaptureMultiple) {
          const batch = await analyzeUploadedChequeDraftBatch(file)
          if (batch.length >= 2) {
            const nextDrafts = await Promise.all(
              batch.map((item) => createDraftItem(item.draft, item.qrValue)),
            )
            setDrafts((previous) => [...previous, ...nextDrafts])
            setSelectedDraftId(nextDrafts[0]?.id ?? null)
            setCaptureState('editing')
            return
          }
        }

        const analysis = await analyzeUploadedCheckImage(file)
        if (!analysis.draft.previewDataURL || !analysis.draft.width || !analysis.draft.height) {
          throw new Error('Yuklenen resim islenemedi. Baska bir resim deneyin.')
        }

        const initialCorners =
          analysis.draft.detectedCorners ??
          createGuideCorners(analysis.draft.width, analysis.draft.height)

        const nextDraft = await createDraftItem(
          {
            sourceCanvas: analysis.draft.sourceCanvas,
            previewDataURL: analysis.draft.previewDataURL,
            width: analysis.draft.width,
            height: analysis.draft.height,
            corners: initialCorners,
          },
          analysis.qrValue,
        )

        appendDraft(nextDraft)
        setCaptureState('editing')

        if (!analysis.draft.detectedCorners) {
          setCaptureError('Cek otomatik algilanamadi. Koseleri elle duzeltin.')
        }
      } catch (error: unknown) {
        const message = resolveCaptureErrorMessage(error)
        setCaptureError(message)
        onError?.(message)
      } finally {
        setIsUploadAnalyzing(false)
      }
    },
    [appendDraft, createDraftItem, onCaptureMultiple, onError],
  )

  if (captureState === 'error') {
    return (
      <section className="flex h-[100dvh] w-full items-center justify-center bg-black px-6">
        <div className="max-w-sm space-y-4 text-center">
          <p className="text-3xl">📷</p>
          <h2 className="text-lg font-semibold text-white">Kamera Hatası</h2>
          <p className="text-sm leading-relaxed text-white/70">
            {captureError || cameraError?.message || 'Kamera başlatılamadı.'}
          </p>
          <button
            type="button"
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            onClick={handleRetryCamera}
          >
            Tekrar Dene
          </button>
        </div>
      </section>
    )
  }

  if (captureState === 'loading') {
    return (
      <section className="relative h-[100dvh] w-full overflow-hidden bg-black">
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-emerald-500" />
          <p className="text-lg font-semibold text-white">
            {!isReady && !workerReady && documentMode
              ? 'Kamera ve tarayıcı başlatılıyor...'
              : !isReady
                ? 'Kamera başlatılıyor...'
                : 'Tarayıcı motoru hazırlanıyor...'}
          </p>
        </div>
      </section>
    )
  }

  if (captureState === 'adjusting' && captureDraft && selectedDraft) {
    return (
      <section className="relative h-[100dvh] w-full overflow-hidden bg-black">
        <AdjustScreen
          imageSrc={captureDraft.previewDataURL}
          sourceWidth={captureDraft.width}
          sourceHeight={captureDraft.height}
          initialCorners={captureDraft.corners}
          isProcessing={isProcessing}
          onRetake={() => {
            setCaptureState('editing')
          }}
          onConfirm={(cornersValue) => {
            void handleConfirmAdjustment(cornersValue)
          }}
          title={`Çek ${drafts.findIndex((item) => item.id === selectedDraft.id) + 1} köşelerini düzenleyin`}
          description="Tutamaçları çek köşelerine taşıyın, sonra değişikliği kaydedin."
          retakeLabel="Editöre Dön"
          confirmLabel="Kaydet"
        />
        {captureError ? (
          <div className="absolute left-4 right-4 top-4 z-30 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {captureError}
          </div>
        ) : null}
      </section>
    )
  }

  if (captureState === 'editing' && selectedDraft) {
    return (
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-black text-white">
        <div className="flex items-center justify-between px-4 pb-3 pt-safe">
          <button
            type="button"
            className="rounded-full border border-[#007A3D] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              setCaptureState('scanning')
            }}
          >
            Geri
          </button>
          <p className="text-lg font-semibold text-white">
            {drafts.findIndex((item) => item.id === selectedDraft.id) + 1} / {drafts.length}
          </p>
          <button
            type="button"
            className="rounded-full bg-[#007A3D] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={handleFinalizeSession}
            disabled={drafts.length === 0}
          >
            Devam Et
          </button>
        </div>

        {selectedDraft.qrValue ? (
          <div className="px-6">
            <div className="rounded-full border border-[#007A3D] bg-black px-4 py-3 text-center text-sm text-white">
              {selectedDraft.qrValue}
            </div>
          </div>
        ) : null}

        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-6">
          <img
            src={selectedDraft.processed.dataURL}
            alt="Seçilen çek önizleme"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          {isProcessing ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/65">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-emerald-500" />
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 bg-black px-4 py-4">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {drafts.map((draft, index) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => {
                  setSelectedDraftId(draft.id)
                }}
                className={`relative h-[54px] min-w-[110px] overflow-hidden rounded-[6px] border transition-opacity ${
                  draft.id === selectedDraft.id
                    ? 'border-[#007A3D] opacity-100'
                    : 'border-white/15 opacity-70'
                }`}
              >
                <img
                  src={draft.processed.dataURL}
                  alt={`Çek ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              ['color', 'Renkli'],
              ['enhanced', 'Gelişmiş'],
              ['bw', 'S/B'],
            ] as Array<[EnhancementMode, string]>).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  void handleChangeDraftMode(mode)
                }}
                className={`min-h-[52px] rounded-full border text-lg font-semibold transition-colors ${
                  selectedDraft.enhancementMode === mode
                    ? 'border-[#007A3D] bg-[#007A3D] text-white'
                    : 'border-[#007A3D] bg-black text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleBeginAdjustDraft}
              className="min-h-[48px] rounded-xl border border-white/12 bg-white/10 font-semibold text-white"
            >
              Köşeleri Düzenle
            </button>
            <button
              type="button"
              onClick={handleDeleteSelectedDraft}
              className="min-h-[48px] rounded-xl border border-red-400/40 bg-red-500/10 font-semibold text-red-200"
            >
              Çeki Sil
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <ScannerView
        videoRef={setVideoRef}
        devices={devices}
        activeDeviceId={activeDeviceId}
        onSwitchCamera={switchCamera}
        torchSupported={torchSupported}
        torchEnabled={torchEnabled}
        torchBusy={torchBusy}
        flashMode={flashMode}
        flashModeOptions={flashModeOptions}
        onApplyFlashMode={(mode) => {
          void applyFlashMode(mode)
        }}
        onToggleTorch={() => {
          void toggleTorch()
        }}
        corners={corners}
        isDetecting={isDetecting}
        isStable={isStable}
        workerEngine={workerEngine}
        canCapture={canCapture}
        orientationPrompt={orientationPrompt}
        showRotationGuide={Boolean(documentMode && !isOrientationReady)}
        needsToMoveCloser={Boolean(needsToMoveCloser)}
        showGuideOverlay={documentMode}
        instructionText={instructionText}
        qrRequired={shouldRequireQr}
        qrValue={liveQrValue}
        onCapture={() => {
          void handleCapture()
        }}
        onCornersChange={(nextCorners) => {
          localCornersRef.current = nextCorners
        }}
      />

      <canvas ref={qrCanvasRef} className="hidden" aria-hidden="true" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFileUpload(event)
        }}
      />

      <div className="absolute right-4 top-[70px] z-20 flex gap-2">
        <button
          type="button"
          onClick={handlePickImage}
          disabled={isUploadAnalyzing}
          className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs font-semibold text-white backdrop-blur disabled:opacity-50"
        >
          {isUploadAnalyzing ? 'Analiz...' : 'Resim Yükle'}
        </button>
        <button
          type="button"
          onClick={handleFinalizeSession}
          disabled={drafts.length === 0}
          className="rounded-full bg-[#007A3D] px-4 py-2 text-xs font-semibold text-white disabled:opacity-45"
        >
          Devam Et
        </button>
      </div>

      {drafts.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            handleOpenDraft(selectedDraftId ?? drafts[drafts.length - 1]?.id ?? '')
          }}
          className="absolute bottom-[34px] left-1/2 z-20 h-[64px] w-[124px] -translate-x-[170px]"
        >
          {drafts.slice(-3).map((draft, index, items) => {
            const stackIndex = items.length - index - 1
            const isTopCard = index === items.length - 1

            return (
              <div
                key={draft.id}
                className={`absolute bottom-0 left-0 h-[45px] w-[99px] overflow-hidden rounded-[5px] border transition-all ${
                  isTopCard ? 'border-[#007A3D] opacity-100' : 'border-white/15 opacity-65'
                }`}
                style={{
                  transform: `translate(${stackIndex * 6}px, ${stackIndex * -3}px) scale(${1 - stackIndex * 0.03})`,
                  zIndex: index + 1,
                }}
              >
                <img
                  src={draft.processed.dataURL}
                  alt={`Çek ${drafts.findIndex((item) => item.id === draft.id) + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            )
          })}

          <span className="absolute right-0 top-0 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#007A3D] text-[18px] font-semibold text-white shadow-[0_8px_18px_rgba(0,122,61,0.35)]">
            {drafts.length}
          </span>
        </button>
      ) : null}

      {captureError ? (
        <div className="absolute left-4 right-4 top-4 z-30 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {captureError}
        </div>
      ) : null}
    </section>
  )
}

export default CameraCapture
