/** "1 wedstrijd" / "3 wedstrijden": count with the right singular or plural word. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
