import type { Problem } from "@/domain/problem/Problem";

/**
 * Seed problems. Requirements are written so that design decisions have
 * somewhere to live: each requirement maps to keyword hints the deterministic
 * evaluator can look for, and the open-ended ones give the LLM reviewer
 * something to reason about.
 */
export const SEED_PROBLEMS: Problem[] = [
  {
    slug: "parking-lot",
    title: "Parking Lot",
    difficulty: "Medium",
    summary:
      "Design a multi-floor parking lot that allocates spots by vehicle type, issues tickets, and computes fees at exit.",
    estimatedMinutes: 45,
    statement: `Design the internal structure of an automated multi-floor parking lot.

The lot has many floors; each floor contains parking spots of different types (motorcycle, compact, large). Vehicles arrive, are allocated a suitable free spot, receive a ticket, and pay on exit based on how long they stayed.

Your design should let a reviewer see **who owns which decision**: where spot allocation lives, who computes pricing, how new vehicle or spot types appear, and how the lot reports availability.`,
    requirements: [
      {
        id: "pl-req-1",
        description: "Support multiple vehicle types (motorcycle, car, truck) with different size needs.",
        keywords: ["vehicle", "motorcycle", "car", "truck", "vehicletype"],
      },
      {
        id: "pl-req-2",
        description: "Support different spot types per floor, and fit vehicles to compatible spots.",
        keywords: ["spot", "parkingspot", "floor", "compact", "large"],
      },
      {
        id: "pl-req-3",
        description: "Allocate the first available compatible spot when a vehicle enters.",
        keywords: ["allocat", "assign", "findspot", "available"],
      },
      {
        id: "pl-req-4",
        description: "Issue a ticket on entry recording vehicle, spot, and entry time.",
        keywords: ["ticket", "entrytime", "issue"],
      },
      {
        id: "pl-req-5",
        description: "Compute the parking fee on exit from duration and vehicle/spot pricing rules.",
        keywords: ["fee", "price", "pricing", "charge", "payment", "calculate"],
      },
      {
        id: "pl-req-6",
        description: "Free the spot and record the exit so the spot becomes reusable.",
        keywords: ["exit", "free", "release", "vacate", "checkout"],
      },
      {
        id: "pl-req-7",
        description: "Report availability (free count per spot type) without scanning semantics leaking into callers.",
        keywords: ["availability", "available", "display", "freecount", "status"],
      },
    ],
    assumptions: [
      "Payment can be modelled as a single settle-at-exit flow; you do not need gate hardware integration.",
      "You may assume the system runs in one process; persistence is out of scope but state ownership matters.",
    ],
    designConsiderations: [
      "Who decides which spot a vehicle gets — the lot, a floor, or an allocation strategy?",
      "If a new vehicle type (e.g. EV with charging) is added tomorrow, how much code changes?",
      "Where does pricing live? A hardcoded switch in the exit flow is a smell most reviewers will flag.",
      "Does your Vehicle hierarchy leak into classes that should not care about vehicle kinds?",
    ],
  },
  {
    slug: "vending-machine",
    title: "Vending Machine",
    difficulty: "Medium",
    summary:
      "Design a vending machine's core: product inventory, coin/note handling, dispense flow, change, and refund paths.",
    estimatedMinutes: 40,
    statement: `Design the internal structure of a vending machine controller.

The machine holds products in slots, accepts money in multiple denominations, lets the user select a product, dispenses it, returns change, and must refund cleanly when the user cancels or the product is sold out.

The interesting part is the **state and invariants**: money inserted but not spent, stock per slot, and the transitions between idle / selecting / dispensing / refunding.`,
    requirements: [
      {
        id: "vm-req-1",
        description: "Track product inventory per slot with quantity and price.",
        keywords: ["inventory", "slot", "product", "stock", "quantity"],
      },
      {
        id: "vm-req-2",
        description: "Accept coins/notes of multiple denominations and track the inserted balance.",
        keywords: ["coin", "note", "payment", "balance", "denomination", "insert"],
      },
      {
        id: "vm-req-3",
        description: "Let the user select a product and dispense it only when paid in full and in stock.",
        keywords: ["select", "dispense", "vend"],
      },
      {
        id: "vm-req-4",
        description: "Return change when the inserted balance exceeds the price.",
        keywords: ["change", "refund", "return"],
      },
      {
        id: "vm-req-5",
        description: "Cancel mid-transaction and refund the inserted money.",
        keywords: ["cancel", "refund"],
      },
      {
        id: "vm-req-6",
        description: "Prevent invalid transitions — e.g. dispense with insufficient balance or empty slot.",
        keywords: ["state", "invalid", "insufficient", "soldout", "guard"],
      },
    ],
    assumptions: [
      "The machine has unlimited capacity for coins in its cash box.",
      "One transaction at a time; no concurrency modelling required.",
    ],
    designConsiderations: [
      "Do you model the machine's states explicitly (State pattern) or guard with booleans? Either can be defensible — justify the choice.",
      "Who is allowed to decrease stock — the controller, the slot, or the product?",
      "Where does change computation live, and could a different payment mechanism (card) replace coins without rewriting the controller?",
    ],
  },
  {
    slug: "elevator-system",
    title: "Elevator System",
    difficulty: "Hard",
    summary:
      "Design a multi-elevator controller: request handling, scheduling, floor state, door lifecycle, and capacity.",
    estimatedMinutes: 55,
    statement: `Design the internal structure of a building's elevator control system.

A building has several elevators. Passengers request pickups from floors and destinations inside cars. The controller decides which elevator serves which request, elevators move and open/close doors, and displays show current floor and direction.

The heart of the problem is the **scheduling decision** and how it stays testable: a naive controller hardcodes "next floor in list", which makes every future policy change a rewrite.`,
    requirements: [
      {
        id: "el-req-1",
        description: "Support multiple elevators serving a shared set of floors.",
        keywords: ["elevator", "car", "multiple"],
      },
      {
        id: "el-req-2",
        description: "Accept pickup requests from floors and destination requests from inside cars.",
        keywords: ["request", "pickup", "destination", "floor"],
      },
      {
        id: "el-req-3",
        description: "Schedule which elevator serves a request (a pluggable strategy, not hardcoded).",
        keywords: ["schedul", "strategy", "assign", "algorithm", "dispatch"],
      },
      {
        id: "el-req-4",
        description: "Model elevator movement with direction and current floor state.",
        keywords: ["direction", "up", "down", "currentfloor", "move"],
      },
      {
        id: "el-req-5",
        description: "Model door lifecycle: open while boarding, close before moving.",
        keywords: ["door", "open", "close"],
      },
      {
        id: "el-req-6",
        description: "Respect car capacity and reject/skip serving when full.",
        keywords: ["capacity", "weight", "full", "load"],
      },
      {
        id: "el-req-7",
        description: "Expose display state (floor, direction) for panels without exposing internals.",
        keywords: ["display", "panel", "status", "show"],
      },
    ],
    assumptions: [
      "Movement between floors is instantaneous in the model; you are designing structure, not physics.",
      "Safety interlocks can be expressed as invariants/exceptions rather than hardware signalling.",
    ],
    designConsiderations: [
      "Where does the scheduling strategy live, and can a new one be swapped in without touching elevator internals?",
      "Does the Elevator class own its request queue, or does the controller? What are the consequences of each?",
      "How do you prevent the controller from reaching into an elevator's internal state to decide things?",
    ],
  },
];
