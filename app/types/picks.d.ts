// /app/types/picks.d.ts

export type PickSelection = {
    driver: string;
    team: string;
    line: number;
    betterOrWorse: 'mejor' | 'peor' | null;
    gp_name: string;
    session_type: SessionType;
  };
  
  export type GameMode = 'full throttle' | 'safety';