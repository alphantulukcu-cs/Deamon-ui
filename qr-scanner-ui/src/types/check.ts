export interface CapturedCheck {
  id: string
  photoDataUrl: string
  originalPhotoDataUrl: string
  qrValue: string
  enhancementMode?: 'color' | 'bw' | 'enhanced'
}

export interface CheckSession {
  checks: CapturedCheck[]
}

export type CheckCaptureStep =
  | 'home-landing'
  | 'pre-start-info'
  | 'check-photo'
  | 'check-summary'
  | 'session-summary'
