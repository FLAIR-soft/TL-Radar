// Множественные числа для строк вида «Überfällig seit 8 Tagen» / «2 Pausen».
// В немецком и английском форм две, в русском — четыре, поэтому словари хранят
// все четыре ключа Intl.PluralRules, а недостающие просто повторяют other.
export type PluralForms = {
  one: string;
  few: string;
  many: string;
  other: string;
};

export function plural(forms: PluralForms, n: number, intlLocale: string): string {
  const rule = new Intl.PluralRules(intlLocale).select(n);
  const template = forms[rule as keyof PluralForms] ?? forms.other;
  return template.replace('{n}', String(n));
}
