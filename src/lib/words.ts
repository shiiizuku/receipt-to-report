const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: Array<[number, string]> = [
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
];

function belowThousand(n: number): string {
  let out = "";
  if (n >= 100) {
    out += `${ONES[Math.floor(n / 100)]} hundred `;
    n %= 100;
  }
  if (n >= 20) out += `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""} `;
  else if (n > 0) out += `${ONES[n]} `;
  return out;
}

/** "Seventy-two thousand five hundred pesos only" / "... pesos and 50/100". */
export function amountInWords(cents: number): string {
  let pesos = Math.floor(Math.abs(cents) / 100);
  const centavos = Math.abs(cents) % 100;
  let out = pesos === 0 ? "zero " : "";
  for (const [size, name] of SCALES) {
    if (pesos >= size) {
      out += `${belowThousand(Math.floor(pesos / size))}${name} `;
      pesos %= size;
    }
  }
  out += belowThousand(pesos);
  out = `${out.trim()} pesos${centavos ? ` and ${centavos}/100` : " only"}`;
  return out.charAt(0).toUpperCase() + out.slice(1);
}
