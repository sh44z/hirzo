const protectedCharacteristicPattern =
  /\b(?:age|aged|sex|gender|gender reassignment|gender identity|race|ethnic(?:ity|ities)|disabilit(?:y|ies)|disabled|religion|belief|marital status|civil partnership|pregnan(?:t|cy)|maternity|sexual orientation|national origin|nationality|ancestry|veteran status|genetic information)\b/i;

export function containsProtectedCharacteristic(value: string) {
  return protectedCharacteristicPattern.test(value);
}
