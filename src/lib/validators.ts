const CPF_FORMAT = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const CRM_FORMAT = /^\d{1,10}-[A-Z]{2}$/;

/** Estados brasileiros aceitos no sufixo do CRM. */
const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

/** Mantém apenas dígitos. */
export const onlyDigits = (value: string): string => (value || '').replace(/\D/g, '');

/** Verifica apenas a máscara `XXX.XXX.XXX-XX`. */
export const isCPFFormat = (cpf: string): boolean => CPF_FORMAT.test((cpf || '').trim());

/**
 * Valida um CPF de verdade: máscara, repetição trivial e os dois dígitos
 * verificadores. A versão anterior checava só o formato, então qualquer
 * sequência como `111.111.111-11` entrava no prontuário.
 */
export const validateCPF = (cpf: string): boolean => {
  const value = (cpf || '').trim();
  if (!isCPFFormat(value)) return false;

  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
};

/** Valida CRM no formato `NÚMERO-UF` com UF brasileira existente. */
export const validateCRM = (crm: string): boolean => {
  const value = (crm || '').trim();
  if (!CRM_FORMAT.test(value)) return false;
  return UFS.includes(value.slice(-2));
};

/** Aplica a máscara de CPF progressivamente enquanto o usuário digita. */
export const formatCPF = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
};

/** Aplica a máscara de telefone `(XX) XXXXX-XXXX`. */
export const formatPhone = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.replace(/^(\d{0,2})/, '($1');
  if (digits.length <= 6) return digits.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};

/** Telefone válido: 10 dígitos (fixo) ou 11 (celular). */
export const validatePhone = (value: string): boolean => {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
};

/** Impede cadastro de nascimento no futuro ou absurdamente antigo. */
export const validateBirthDate = (iso: string, today: Date = new Date()): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (Number.isNaN(date.getTime())) return false;
  if (date.getTime() > today.getTime()) return false;
  return today.getFullYear() - date.getFullYear() <= 130;
};
