declare module '@3d-dice/dice-box' {
  type DiceRollOptions = {
    theme?: string;
    themeColor?: string;
    newStartPoint?: boolean;
  };

  // dice-box accepts either a text notation ("2d6+3") or an array of per-group
  // specs. Giving each group qty:1 with its own themeColor colors dice individually.
  type DiceGroupSpec = {
    sides: number | string;
    qty?: number;
    themeColor?: string;
    modifier?: number;
    data?: string;
  };

  type DiceNotation = string | DiceGroupSpec[];

  type DiceBoxConfig = {
    container: string;
    id?: string;
    assetPath: string;
    theme?: string;
    themeColor?: string;
    gravityScale?: number;
    scale?: number;
    throwForce?: number;
    spinForce?: number;
  };

  export type DiceRollResult = {
    value?: number;
    sides?: number;
    modifier?: number;
    /** dice-box's handle on one die that is on the surface. Only it can identify a die to reroll. */
    rollId?: number;
    groupId?: number;
    theme?: string;
    themeColor?: string;
  };

  export default class DiceBox {
    constructor(config: DiceBoxConfig);
    init(): Promise<void>;
    clear(): this;
    roll(notation: DiceNotation, options?: DiceRollOptions): Promise<DiceRollResult[]>;
    reroll(
      dice: DiceRollResult | DiceRollResult[],
      options?: DiceRollOptions & { remove?: boolean; hide?: boolean },
    ): Promise<DiceRollResult[]>;
    updateConfig(config: Partial<DiceBoxConfig>): void;
  }
}
