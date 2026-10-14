import type {SlipFields} from './slip';

/**
 * Tesseract's page-level confidence does not certify financial values.
 * Treat very low confidence as a trigger for a second, independently enhanced
 * recognition pass. Require agreement on every auto-save field.
 */
export const LOW_OCR_CONFIDENCE=55;

export function isLowOcrConfidence(confidence:number|null|undefined):boolean {
  return typeof confidence==='number'&&Number.isFinite(confidence)&&confidence<LOW_OCR_CONFIDENCE;
}

function recipientKey(value:string|null):string|null {
  return value===null?null:value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s.,\-]/gu,'');
}

/** Only additional guard for a low-confidence first pass; never overrides data conflicts. */
export function requiresLowConfidenceReview(
  first:SlipFields,
  recovery:SlipFields|null,
  firstConfidence:number|null|undefined,
  recoveryConfidence:number|null|undefined,
):boolean {
  if(!isLowOcrConfidence(firstConfidence))return false;
  if(!recovery||recoveryConfidence==null||isLowOcrConfidence(recoveryConfidence))return true;
  return first.amountSatang===null||first.date===null||first.time===null||first.recipient===null||
    first.direction===null||recovery.amountSatang!==first.amountSatang||
    recovery.date!==first.date||recovery.time!==first.time||
    recipientKey(recovery.recipient)!==recipientKey(first.recipient)||
    recovery.direction!==first.direction;
}
