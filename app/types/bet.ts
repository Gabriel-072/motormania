export type BetSelection = {
    value: string; // Driver or team name
    wager_amount: number; // Amount in COP
    turbo: boolean; // Whether turbo is applied
  };
  
  export type Bet = {
    pole1: BetSelection;
    pole2: BetSelection;
    pole3: BetSelection;
    gp1: BetSelection;
    gp2: BetSelection;
    gp3: BetSelection;
    fastest_pit_stop_team: BetSelection;
    fastest_lap_driver: BetSelection;
    driver_of_the_day: BetSelection;
    first_team_to_pit: BetSelection;
    first_retirement: BetSelection;
  };