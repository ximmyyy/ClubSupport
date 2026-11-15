export type Category = "pupillen" | "junioren" | "senioren" | "vrouwen" | "recreatief";
export type FieldNeed = "heel" | "half" | "kwart";
export type Surface = "kunstgras" | "natuurgras";

export interface Club {
  name: string;
  shortName: string;
  city: string;
  sport: "voetbal";
  /** Minutes before kick-off a team gets its changing room */
  roomBefore: number;
  /** Minutes after the final whistle a team keeps its changing room */
  roomAfter: number;
  /** Cleaning / turnover buffer between two users of the same changing room */
  roomBuffer: number;
  /** Buffer between two matches on the same field section */
  fieldBuffer: number;
  /** Youngest age group that gets a changing room on match days (JO8/JO9 usually come dressed) */
  roomsFromAge: number;
}

export interface Field {
  id: string;
  name: string;
  surface: Surface;
  lit: boolean;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  kind: "team" | "scheidsrechter";
}

export interface Team {
  id: string;
  name: string;
  category: Category;
  trainer: string;
  players: number;
  fieldNeed: FieldNeed;
  /** Field time of a match in minutes (play + break) */
  matchDuration: number;
  /** Does this team use a changing room after training? */
  roomForTraining: boolean;
}

export type BookingKind = "training" | "overig";

/** A field booking. Either recurring (weekday) or one-off (date). Matches are separate. */
export interface Booking {
  id: string;
  kind: BookingKind;
  fieldId: string;
  sections: number[];
  start: number;
  end: number;
  teamId?: string;
  label?: string;
  /** 1 = maandag … 7 = zondag, for weekly recurring bookings */
  weekday?: number;
  /** For one-off bookings */
  date?: string;
  /** Dates on which a recurring booking does not take place */
  exceptions?: string[];
}

export type MatchStatus = "gepland" | "afgelast" | "gespeeld";

export interface Match {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  kickoff: number;
  home: boolean;
  fieldId?: string;
  sections?: number[];
  status: MatchStatus;
  referee?: string;
  scoreHome?: number;
  scoreAway?: number;
}

export type RoomRole = "thuis" | "uit" | "scheidsrechter" | "training" | "overig";

export interface RoomAssignment {
  id: string;
  roomId: string;
  date: string;
  start: number;
  end: number;
  role: RoomRole;
  teamId?: string;
  matchId?: string;
  label: string;
}

export type DutyRole =
  | "bardienst"
  | "scheidsrechter"
  | "wedstrijdsecretariaat"
  | "kleedkamercontrole"
  | "veldopbouw";

export interface Duty {
  id: string;
  date: string;
  start: number;
  end: number;
  role: DutyRole;
  person?: string;
  /** Team responsible for filling this duty */
  teamId?: string;
  matchId?: string;
}

export interface FieldClosure {
  id: string;
  fieldId: string;
  date: string;
  reason: string;
}

export type RequestStatus = "open" | "goedgekeurd" | "afgewezen";

/**
 * A trainer's request to move a training or home match, or to get an extra training.
 * `bookingId` / `matchId` point at what should change; neither means "extra training".
 */
export interface ChangeRequest {
  id: string;
  teamId: string;
  bookingId?: string;
  matchId?: string;
  /** For trainings: only on `date`, or the weekly series from now on */
  scope: "eenmalig" | "reeks";
  date: string;
  fieldId: string;
  sections: number[];
  start: number;
  end: number;
  note: string;
  status: RequestStatus;
  createdBy?: string;
  createdByName: string;
  createdAt?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface AppData {
  version: 1;
  club: Club;
  fields: Field[];
  rooms: Room[];
  teams: Team[];
  bookings: Booking[];
  matches: Match[];
  roomAssignments: RoomAssignment[];
  duties: Duty[];
  closures: FieldClosure[];
  requests: ChangeRequest[];
}
