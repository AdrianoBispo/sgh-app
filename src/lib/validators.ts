export const validateCPF = (cpf: string): boolean => {
  const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
  return cpfRegex.test(cpf);
};

export const validateCRM = (crm: string): boolean => {
  const crmRegex = /^\d+-[A-Z]{2}$/;
  return crmRegex.test(crm);
};
