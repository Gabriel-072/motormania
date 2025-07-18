// types/vip.ts

export interface VipOrder {
    id: number;
    order_id: string;
    user_id: string;
    gp_name: string;
    predictions: any;
    amount_cop: number;
    status: 'pending' | 'completed' | 'failed';
    created_at: string;
    processed_at?: string;
  }
  
  export interface Prediction {
    pole1: string;
    pole2: string;
    pole3: string;
    gp1: string;
    gp2: string;
    gp3: string;
    fastest_pit_stop_team: string;
    fastest_lap_driver: string;
    driver_of_the_day: string;
    first_team_to_pit: string;
    first_retirement: string;
    is_vip?: boolean;
  }
  
  export interface LeaderboardEntry {
    user_id: string;
    name: string;
    score: number;
    gp_name?: string;
    is_vip?: boolean;
  }
  
  export interface BoldCheckoutConfig {
    apiKey: string;
    orderId: string;
    amount: string;
    currency: 'COP' | 'USD';
    description: string;
    redirectionUrl: string;
    integritySignature: string;
    customerData?: string;
    onSuccess?: () => void;
    onFailed?: (error: { message?: string }) => void;
    onPending?: () => void;
    onClose?: () => void;
  }