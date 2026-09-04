export interface Contractor {
  companyName: string;
  phone: string;
  email: string;
  bankAccount: string;
  nip?: string;
  logoBase64?: string;
}

export interface Client {
  name: string;
  phone: string;
  address: string;
}

export interface EstimateItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPriceNet: number;
  totalNet: number;
}

export interface EstimateData {
  estimateNumber: string;
  issueDate: string;
  validUntil: string;
  contractor: Contractor;
  client: Client;
  items: EstimateItem[];
  advancePercent: number;
}