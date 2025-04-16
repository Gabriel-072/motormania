// app/types/standings.ts
export interface DriverStanding {
    position: number;
    driver: string;
    points: number;
    evolution: string;
  }
  
  export interface ConstructorStanding {
    position: number;
    constructor: string;
    points: number;
    evolution: string;
  }
  
  export interface RookieStanding {
    position: number;
    driver: string;
    points: number;
    evolution: string;
  }
  
  export interface DestructorStanding {
    position: number;
    driver: string;
    team: string;
    total_costs: number;
  }
  
  export interface Team {
    name: string;
    logo_url: string;
  }