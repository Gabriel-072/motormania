import { create } from 'zustand';
import { PickSelection } from '../app/types/picks';

type SessionType = 'qualy' | 'race';

type StickyModalState = {
  picks: Record<SessionType, PickSelection[]>;
  currentSession: SessionType;
  showSticky: boolean;
  potentialWin: number;
  multiplier: number;
  wagerAmount: number;
  setSession: (session: SessionType) => void;
  setPicks: (picks: PickSelection[]) => void;
  addPick: (pick: PickSelection) => boolean;
  removePick: (driver: string, session: SessionType) => void; // Updated to accept session
  canAddPick: () => boolean;
  setShowSticky: (value: boolean) => void;
  hideSticky: () => void;
  finishPicks: () => void;
  setMultiplier: (value: number) => void;
  setPotentialWin: (value: number) => void;
  setWagerAmount: (value: number) => void;
  setQualyPicks: (picks: PickSelection[]) => void;
  setRacePicks: (picks: PickSelection[]) => void;
};

export const useStickyStore = create<StickyModalState>((set, get) => ({
  picks: {
    qualy: [],
    race: []
  },
  currentSession: 'qualy',
  showSticky: false,
  potentialWin: 0,
  multiplier: 0,
  wagerAmount: 0,
  setSession: (session) => set({ currentSession: session }),
  setPicks: (newPicks) => {
    const { currentSession } = get();
    set((state) => ({ picks: { ...state.picks, [currentSession]: newPicks } }));
  },
  addPick: (newPick) => {
    const { picks, currentSession } = get();
    const totalPicks = picks.qualy.length + picks.race.length;

    if (totalPicks >= 8) return false;

    const sessionPicks = picks[currentSession];
    const alreadyExists = sessionPicks.some((p) => p.driver === newPick.driver);

    if (alreadyExists) {
      const updated = sessionPicks.map((p) =>
        p.driver === newPick.driver ? newPick : p
      );
      set((state) => ({
        picks: { ...state.picks, [currentSession]: updated },
        showSticky: true,
      }));
    } else {
      set((state) => ({
        picks: {
          ...state.picks,
          [currentSession]: [...state.picks[currentSession], newPick],
        },
        showSticky: true,
      }));
    }

    return true;
  },
  removePick: (driver, session) => {
    set((state) => ({
      picks: {
        ...state.picks,
        [session]: state.picks[session].filter((p) => p.driver !== driver),
      },
    }));
  },
  canAddPick: () => {
    const { picks } = get();
    return picks.qualy.length + picks.race.length < 8;
  },
  setShowSticky: (value) => set({ showSticky: value }),
  hideSticky: () => set({ showSticky: false }),
  finishPicks: () => {
    const { currentSession } = get();
    set((state) => ({
      picks: { ...state.picks, [currentSession]: [] },
      showSticky: false,
      potentialWin: 0,
      wagerAmount: 0,
    }));
  },
  setMultiplier: (value) => set({ multiplier: value }),
  setPotentialWin: (value) => set({ potentialWin: value }),
  setWagerAmount: (value) => set({ wagerAmount: value }),
  setQualyPicks: (newPicks) => set((state) => ({ picks: { ...state.picks, qualy: newPicks } })),
  setRacePicks: (newPicks) => set((state) => ({ picks: { ...state.picks, race: newPicks } })),
}));