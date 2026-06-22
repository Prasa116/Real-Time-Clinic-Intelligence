export interface Patient {
  token: number;
  name: string;
  status: "waiting" | "serving" | "completed";
}

export interface QueueState {
  queue: Patient[];
  currentActiveToken: number;
  avgConsultationTime: number;
}
