export interface EstimateItem {
  id: string;
  name: string;
  unit: string; // np. m2, szt, mb, godz.
  quantity: number;
  unitPriceNet: number;
  totalNet: number;
}

export interface ClientData {
  name: string;
  phone: string;
  address: string;
}

export interface ContractorData {
  companyName: string;
  phone: string;
  email: string;
  bankAccount: string;
}

export interface EstimateData {
  estimateNumber: string;
  issueDate: string;
  validUntil: string;
  contractor: ContractorData;
  client: ClientData;
  items: EstimateItem[];
  advancePercent: number;
  notes?: string;
  signatureBase64?: string;
}