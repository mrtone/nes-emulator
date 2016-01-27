﻿
enum AddressingMode {
    Accumulator,
    Implied,
    Immediate,
    ZeroPage,
    ZeroPageX,
    ZeroPageY,
    Absolute,
    AbsoluteIndirect,
    AbsoluteX,
    AbsoluteY,
    IndirectX,
    IndirectY,
    Relative,
    BRK,RTI,RTS,JSR
}

enum StatementKind{
    ADC, SBC,
    AND, EOR, ORA,
    ASL, LSR, ROL, ROR,
    BCC, BCS, BEQ, BMI, BNE, BPL, BVC, BVS,
    BIT,
    CLC, CLI, CLD, CLV,
    SEI, SEC, SED,
    CMP, CPX, CPY,
    DEC, DEX, DEY,
    INC, INX, INY,
    JMP, NOP,
    LDA, LDX, LDY,
    PHA, PHP, PLA, PLP,
    BRK, RTI,
    STA, STX, STY, 
    TAX, TAY, TSX, TXA, TXS, TYA,
    JSR, RTS,
    DCP,


    SAX, LAX, ISC, SLO, RLA, SRE, RRA,
    ANC, ALR, ARR, AXS,
    SYA, SXA, XAA, XAS, AXA, LAR
}             
              
enum Register {
    A = 1, X = 2, Y = 4, SP = 8
}

enum MemoryAccessPattern {
    Push,
    Pop,
    Read,
    ReadModifyWrite,
    ReadModifyWriteAndModifyRegister,
    Write,
    Jmp
}

class Ctx {
    st = '';
    indentLevel = 0;

    public indented(body: () => void) {
        this.indentLevel++;
        body();
        this.indentLevel--;
    }

    public indent() {
        this.indentLevel++;
    }

    public unindent() {
        this.indentLevel--;
    }

    write(st: string) {
        this.st += st;
    }

    writeLine(st: string) {
        for (let i = 0; i < this.indentLevel; i++)
            this.st += '    ';
        this.st += st + '\n';
    }

    public getOutput() {
        return this.st;
    }
}

class CycleCount {
    pageCross = 0;
    branchTaken = 0;
    jumpToNewPage = 0;

    constructor(public c: number) { }

    withPageCross() {
        this.pageCross = 1;
        return this;
    }

    withBranchTaken() {
        this.branchTaken = 1;
        return this;
    }
    
    maxCycle() {
        return this.c + this.pageCross + this.branchTaken;
    }

    toString() {
        return this.c + (this.pageCross ? 'pc ' : '') + (this.branchTaken ? 'bc ' :'');
    }

   
}

class Statement {
    constructor(
        public opcode: number,
        public statementKind: StatementKind,
        public addressingMode: AddressingMode,
        public size: number,
        public cycleCount: CycleCount) {}

    getCycles(gen: Mos6502Gen): Cycle[] {
        var mcPayload = gen[StatementKind[this.statementKind]]();
        var mcPostPayload = gen[StatementKind[this.statementKind] + 'Post'] ? gen[StatementKind[this.statementKind] + 'Post']() : null;
        if (mcPostPayload && this.memoryAccessPattern != MemoryAccessPattern.ReadModifyWriteAndModifyRegister)
            throw 'should not have postpayload';

        return gen['get' + AddressingMode[this.addressingMode] + 'Cycles'](this, mcPayload, mcPostPayload);
    }

    get mnemonic() {
        return StatementKind[this.statementKind] + ' ' + AddressingMode[this.addressingMode];
    }

    get regIn() {
        if(this.addressingMode === AddressingMode.Accumulator)
            switch (this.statementKind){
                case StatementKind.DEX:
                case StatementKind.INX:
                case StatementKind.TXA:
                case StatementKind.TXS:
                    return Register.X;
                case StatementKind.DEY:
                case StatementKind.INY:
                case StatementKind.TYA:
                    return Register.Y;

                case StatementKind.ASL:
                case StatementKind.LSR:
                case StatementKind.ROL:
                case StatementKind.ROR:
                case StatementKind.TAX:
                case StatementKind.TAY:
                case StatementKind.ANC:
                case StatementKind.ALR:
                case StatementKind.ARR:
                    return Register.A;
                case StatementKind.TSX:
                    return Register.SP;


                   
            }

        throw 'regIn is not implemented for ' + this.mnemonic;
    }

    get regOut() {
        if (this.memoryAccessPattern === MemoryAccessPattern.Read ||
            this.addressingMode === AddressingMode.Accumulator)

            switch (this.statementKind) {
                case StatementKind.INX:
                case StatementKind.LDX:
                case StatementKind.DEX:
                case StatementKind.TAX:
                case StatementKind.TSX:
                case StatementKind.AXS:

                    return Register.X;

                case StatementKind.LDY:
                case StatementKind.DEY:
                case StatementKind.INY:
                case StatementKind.TAY:

                    return Register.Y;

                case StatementKind.ADC:
                case StatementKind.SBC:
                case StatementKind.AND:
                case StatementKind.BIT:
                case StatementKind.EOR:
                case StatementKind.ORA:
                case StatementKind.LDA:
                case StatementKind.ASL:
                case StatementKind.LSR:
                case StatementKind.ROL:
                case StatementKind.ROR:
                case StatementKind.TXA:
                case StatementKind.TYA:
                case StatementKind.ANC:
                case StatementKind.ALR:
                case StatementKind.ARR:
                    return Register.A;

                case StatementKind.TXS:
                    return Register.SP;
                case StatementKind.CMP:
                case StatementKind.CPX:
                case StatementKind.CPY:
                case StatementKind.NOP:
                case StatementKind.SYA:
                case StatementKind.SXA:
                case StatementKind.XAA:
                case StatementKind.AXA:
                case StatementKind.XAS:
                case StatementKind.LAR:
                    return null;
            
                case StatementKind.LAX:
                    return Register.A | Register.X

            }

        throw('missing output register for ' + this.mnemonic);
    }


    get memoryAccessPattern() {
        switch (this.statementKind) {
            case StatementKind.PHA: case StatementKind.PHP:
                return MemoryAccessPattern.Push;
            case StatementKind.PLA: case StatementKind.PLP:
                return MemoryAccessPattern.Pop;
            case StatementKind.ADC: case StatementKind.AND: case StatementKind.EOR: case StatementKind.ORA:
            case StatementKind.SBC:
            case StatementKind.BCC: case StatementKind.BCS: case StatementKind.BEQ: case StatementKind.BMI:
            case StatementKind.BNE: case StatementKind.BPL: case StatementKind.BVC: case StatementKind.BVS:
            case StatementKind.BIT:
            case StatementKind.CMP: case StatementKind.CPX: case StatementKind.CPY:
            case StatementKind.DEX: case StatementKind.DEY:
            case StatementKind.INX: case StatementKind.INY:
            case StatementKind.LDA: case StatementKind.LDX: case StatementKind.LDY:
            case StatementKind.NOP:
            case StatementKind.CLC: case StatementKind.CLI: case StatementKind.CLD:
            case StatementKind.SEI: case StatementKind.SEC: case StatementKind.SED:
            case StatementKind.CLV:
            case StatementKind.TAX:
            case StatementKind.TAY:
            case StatementKind.TSX:
            case StatementKind.TXA:
            case StatementKind.TXS:
            case StatementKind.TYA:
            case StatementKind.LAX:
            case StatementKind.ANC:
            case StatementKind.ALR:
            case StatementKind.ARR:
            case StatementKind.AXS:
            case StatementKind.SYA:
            case StatementKind.SXA:
            case StatementKind.XAA:
            case StatementKind.AXA:
            case StatementKind.XAS:
            case StatementKind.LAR:
                return MemoryAccessPattern.Read;
            case StatementKind.ASL: case StatementKind.LSR: case StatementKind.DEC: case StatementKind.INC:
            case StatementKind.ROL: case StatementKind.ROR: 
            case StatementKind.DCP:
           
                return MemoryAccessPattern.ReadModifyWrite;
            case StatementKind.JMP:
                return MemoryAccessPattern.Jmp;

            case StatementKind.STX:
            case StatementKind.STA:
            case StatementKind.STY:
            case StatementKind.SAX:
                return MemoryAccessPattern.Write;

            case StatementKind.ISC:
            case StatementKind.SLO:
            case StatementKind.RLA:
            case StatementKind.SRE:
            case StatementKind.RRA:
                return MemoryAccessPattern.ReadModifyWriteAndModifyRegister;

            default:
                throw 'unknown statement kind ' + StatementKind[this.statementKind];
        }
    }
}

class Mc {
    constructor(public st: string) {
        if (st[st.length-1] === ';')
            throw `Unexpected ';' in '${st}'`;
        if (st.indexOf('\n') !== -1)
            throw `Unexpected linebreak in '${st}'`;
    }

    public static lift(mc: string|Mc):Mc {
        if (mc instanceof Mc)
            return mc;
        return new Mc(<string>mc);
    }
    write(ctx: Ctx) {
        ctx.writeLine(this.st + ';');
    }

    then(mc: string | Mc): Mc {
        return new McCons(this, Mc.lift(mc));
    }

    thenNextStatement(): Mc {
        return new McCons(this, new McNextStatement());
    }

    thenMoveRegToB(register: Register) {
        switch (register) {
            case Register.A: return this.then(`this.b = this.rA`);
            case Register.X: return this.then(`this.b = this.rX`);
            case Register.Y: return this.then(`this.b = this.rY`);
            case Register.SP: return this.then(`this.b = this.sp`);
            default:
                throw 'unknown register to load from';
        }
    }

    thenMoveBToReg(register:Register): Mc {
        if (!register)
            return this;

        let res:Mc = this; 
        if (register & Register.A) res = res.then(`this.rA = this.b`);
        if (register & Register.X) res = res.then(`this.rX = this.b`);
        if (register & Register.Y) res = res.then(`this.rY = this.b`);
        if (register & Register.SP) res = res.then(`this.sp = this.b`);

        return res;
    }
}

class McCons extends Mc {
    constructor(private mcA: Mc, private mcB: Mc) {
        super('');
    }

    write(ctx: Ctx) {
        this.mcA.write(ctx);
        this.mcB.write(ctx);
    }
}
class McNextStatement extends Mc{
    constructor() {
        super('this.t = 0');
    }
}

class McNextCycle extends Mc {
    constructor() {
        super('this.t++');
    }
}
class McNop extends Mc {
    constructor() {
        super('');
    }

    write(ctx: Ctx) {
     
    }
}

class McExpr extends Mc {

    constructor(public expr: string) {
        super(expr);
    }

    write(ctx: Ctx) {
        ctx.write(this.expr);
    }

}

class McIf extends Mc {
    public mcTrue:Mc;
    public mcFalse:Mc;
    constructor(public cond: string, mcTrue:string|Mc, mcFalse:string|Mc) {
        super('');
        this.mcTrue = Mc.lift(mcTrue);
        this.mcFalse = Mc.lift(mcFalse);
    }

    write(ctx:Ctx) {
        ctx.writeLine(`if (${this.cond}) {`);
        ctx.indented(() => this.mcTrue.write(ctx));

        if (!(this.mcFalse instanceof McNop)) {
            ctx.writeLine(`} else {`);
            ctx.indented(() => this.mcFalse.write(ctx));
        }
        ctx.writeLine(`}`);
    }
}

class Cycle {

    mc: Mc;
    pcIncremented = 0;
    constructor(public icycle:number, public desc:string) {
        this.mc = new McNop();
    }

    fetchOpcode() {
        return this;
    }

    withDummyPcIncrement() {
        if (this.pcIncremented)
            throw 'PC is already incremented';
        this.pcIncremented++;
        return this;
    }

    thenIncrementPC() {
        this.withDummyPcIncrement();
        this.mc = this.mc.then('this.ip++');
        return this;
    }

    then(mc: string | Mc) {
        if (!mc)
            return this;
        this.mc = this.mc.then(mc);
        return this;
    }

    thenMoveBToReg(register?: Register) {
        this.mc = this.mc.thenMoveBToReg(register);
        return this;
    }

    thenIf(o: { cond: string, if: string | Mc, else?: string | Mc }) {
        let cond = o.cond;
        let mcTrue = o.if;
        let mcFalse = o.else;

        if (!(mcTrue instanceof Mc))
            mcTrue = new Mc(<string>mcTrue);
        if (!(mcFalse instanceof Mc))
            mcFalse = mcFalse ? new Mc(<string>mcFalse) : new McNop();

        this.mc = this.mc.then(new McIf(cond, mcTrue, mcFalse));
        return this;
    }

    thenNextCycle() {
        this.mc = this.mc.then(new McNextCycle());
        return this;
    }


    thenNextStatement() {
        this.mc = this.mc.then(new McNextStatement());
        return this;
    }

    thenMoveRegToB(regIn: Register) {
        this.mc = this.mc.thenMoveRegToB(regIn);
        return this;
    }
}


export class Mos6502Gen {

    private getRegAccess(reg:Register) {
        return `this.r${Register[reg].toString()}`;
    }

    private NOP(): Mc { return new McNop(); }

    private ADC(): Mc {
        return new McNop()
            .then(`const sum = this.rA + this.b + this.flgCarry`)
            .then(`const bothPositive = this.b < 128 && this.rA < 128`)
            .then(`const bothNegative = this.b >= 128 && this.rA >= 128`)
            .then(`this.flgCarry = sum > 255 ? 1 : 0`)
            .then(`this.b = sum % 256`)
            .then(`this.flgNegative = this.b >= 128 ? 1 : 0`)
            .then(`this.flgZero = this.b === 0 ? 1 : 0`)
            .then(`this.flgOverflow = bothPositive && this.flgNegative || bothNegative && !this.flgNegative ? 1 : 0`);
    }

    private SBC(): Mc {
        return new McNop()
            .then(`this.b = 255 - this.b`)
            .then(this.ADC());
    }

    private BinOp(op: string) {
        return new McNop()
            .then(`this.b ${op}= this.rA`)
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b >= 128 ? 1 : 0`);
    }

    private AND(): Mc { return this.BinOp('&'); }
    private EOR(): Mc { return this.BinOp('^'); }
    private ORA(): Mc { return this.BinOp('|'); }

    private CMPReg(register:Register): Mc {
        return new McNop()
            .then(`this.flgCarry = ${this.getRegAccess(register)} >= this.b ? 1 : 0`)
            .then(`this.flgZero =  ${this.getRegAccess(register)} === this.b ? 1 : 0`)
            .then(`this.flgNegative = (${this.getRegAccess(register)} - this.b) & 128 ? 1 : 0`);
    }
    private CMP(): Mc { return this.CMPReg(Register.A); }
    private CPX(): Mc { return this.CMPReg(Register.X); }
    private CPY(): Mc { return this.CMPReg(Register.Y); }

    private LD(): Mc {
        return new McNop()
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b & 128 ? 1 : 0`);
    }

    private LDA(): Mc { return this.LD(); }
    private LDX(): Mc { return this.LD(); }
    private LDY(): Mc { return this.LD(); }

    private BIT(): Mc {

        return new McNop()
            .then(`this.b = this.rA & this.b`)
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b & 128 ? 1 : 0`)
            .then(`this.flgOverflow = this.b & 64 ? 1 : 0`);
    }

    private ASL(): Mc {
        return new McNop()
            .then(`this.flgCarry = this.b & 0x80 ? 1 : 0`)
            .then(`this.b = (this.b << 1) & 0xff`)
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b & 0x80 ? 1 : 0`);
    }

    private LSR(): Mc {
        return new McNop()
            .then(`this.flgCarry = this.b & 1`)
            .then(`this.b = (this.b >> 1) & 0xff`)
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b & 0x80 ? 1 : 0`);
    }

    private ROL(): Mc {
        return new McNop()
            .then(`this.b = (this.b << 1) | this.flgCarry`)
            .then(`this.flgCarry = this.b & 0x100 ? 1 : 0`)
            .then(`this.b &= 0xff`)
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b & 0x80 ? 1 : 0`);
    }

    private ROR(): Mc {
        return new McNop()
            .then(`this.b |= this.flgCarry << 8`)
            .then(`this.flgCarry = this.b & 1 ? 1 : 0`)
            .then(`this.b >>= 1`)
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b & 0x80 ? 1 : 0`);
    }

    private DEC(): Mc {
        return new McNop()
            .then(`this.b = (this.b - 1) & 0xff`)
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b & 0x80 ? 1 : 0`);
    }

    private DEX(): Mc { return this.DEC(); }
    private DEY(): Mc{ return this.DEC(); }

    private INC(): Mc {
        return new McNop()
            .then(`this.b = (this.b + 1) & 0xff`)
            .then(`this.flgZero = !this.b ? 1 : 0`)
            .then(`this.flgNegative = this.b & 0x80 ? 1 : 0`);
    }

    private INX(): Mc { return this.INC(); }
    private INY(): Mc { return this.INC(); }

    private BCC() { return new McExpr('!this.flgCarry'); }
    private BCS() { return new McExpr('this.flgCarry'); }
    private BEQ() { return new McExpr('this.flgZero'); }
    private BMI() { return new McExpr('this.flgNegative'); }
    private BNE() { return new McExpr('!this.flgZero'); }
    private BPL() { return new McExpr('!this.flgNegative'); }
    private BVC() { return new McExpr('!this.flgOverflow'); }
    private BVS() { return new McExpr('this.flgOverflow'); }


    private CLC(): Mc { return new Mc(`this.flgCarry = 0`) } 
    private CLD(): Mc { return new Mc(`this.flgDecimalMode = 0`) } 
    private CLI(): Mc { return new Mc(`this.flgInterruptDisable = 0`) } 
    private SEI(): Mc { return new Mc(`this.flgInterruptDisable = 1`) } 
    private SEC(): Mc { return new Mc(`this.flgCarry = 1`) } 
    private SED(): Mc { return new Mc(`this.flgDecimalMode = 1`) } 
    private CLV(): Mc { return new Mc(`this.flgOverflow = 1`) } 

    private JMP(): Mc { return new McNop(); }

    private PHA(): Mc {
        return new Mc(`this.pushByte(this.rA)`);
    }

    private PLA(): Mc {
        return new Mc(`this.rA = this.popByte()`)
            .then(`this.flgZero = this.rA === 0 ? 1 : 0`)
            .then(`this.flgNegative = this.rA >= 128 ? 1 : 0`);
    }

    private PHP(): Mc {
        return new Mc(`this.flgBreakCommand = 1`)
            .then(`this.pushByte(this.rP)`)
            .then(`this.flgBreakCommand = 0`);
    }

    private PLP(): Mc {
        return new Mc(`this.rP = this.popByte()`);
    }

    private STA(): Mc {
        return new Mc(`this.b = this.rA`);
    }

    private STX(): Mc {
        return new Mc(`this.b = this.rX`);
    }

    private STY(): Mc {
        return new Mc(`this.b = this.rY`);
    }

    private SAX(): Mc {
        return new Mc(`this.b = this.rA & this.rX`);
    }

    private LAX(): Mc {
        return new McNop()
            .then(`this.flgZero = this.b === 0 ? 1 : 0`)
            .then(`this.flgNegative = this.b >= 128 ? 1 : 0`);
    }

    private TAX(): Mc {
        return new McNop()
            .then(`this.flgZero = this.b === 0 ? 1 : 0`)
            .then(`this.flgNegative = this.b >= 128 ? 1 : 0`);
    }
    private TAY(): Mc {
        return new McNop()
            .then(`this.flgZero = this.b === 0 ? 1 : 0`)
            .then(`this.flgNegative = this.b >= 128 ? 1 : 0`);
    }
    private TSX(): Mc {
        return new McNop()
            .then(`this.flgZero = this.b === 0 ? 1 : 0`)
            .then(`this.flgNegative = this.b >= 128 ? 1 : 0`);
    }
    private TXA(): Mc {
        return new McNop()
            .then(`this.flgZero = this.b === 0 ? 1 : 0`)
            .then(`this.flgNegative = this.b >= 128 ? 1 : 0`);
    }
    private TXS(): Mc { return new McNop();}
    private TYA(): Mc {
        return new McNop()
            .then(`this.flgZero = this.b === 0 ? 1 : 0`)
            .then(`this.flgNegative = this.b >= 128 ? 1 : 0`);
    }


    private DCP(): Mc {
        return new McNop()
            .then(`this.b = (this.b - 1) & 0xff`)
            .then(`this.flgCarry = this.rA >= this.b ? 1 : 0`)
            .then(`this.flgZero = this.rA === this.b? 1 : 0`)
            .then(`this.flgNegative = (this.rA - this.b) & 0x80 ? 1 : 0`);
    }



    private ISC(): Mc { return this.INC(); }
    private ISCPost(): Mc { return this.SBC().thenMoveBToReg(Register.A); }
    private SLO(): Mc { return this.ASL(); }
    private SLOPost(): Mc { return this.ORA().thenMoveBToReg(Register.A); }
    private RLA(): Mc { return this.ROL(); }
    private RLAPost(): Mc { return this.AND().thenMoveBToReg(Register.A); }
    private SRE(): Mc { return this.LSR(); }
    private SREPost(): Mc { return this.EOR().thenMoveBToReg(Register.A); }
    private RRA(): Mc { return this.ROR(); }
    private RRAPost(): Mc { return this.ADC().thenMoveBToReg(Register.A); }

    private ALR(): Mc {
        //ALR #i($4B ii; 2 cycles)
        //Equivalent to AND #i then LSR A.
        return this.AND().then(this.LSR());
    }

    private ANC(): Mc{
        //Does AND #i, setting N and Z flags based on the result. 
        //Then it copies N (bit 7) to C.ANC #$FF could be useful for sign- extending, much like CMP #$80.ANC #$00 acts like LDA #$00 followed by CLC.
        return this.AND().
            then(`this.flgCarry = this.flgNegative`);
    }

    private ARR():Mc {
        //Similar to AND #i then ROR A, except sets the flags differently. N and Z are normal, but C is bit 6 and V is bit 6 xor bit 5.
        return this.AND()
            .then(this.ROR())
            .then(`this.flgCarry = (this.b & (1 << 6)) !== 0 ? 1 : 0`)
            .then(` this.flgOverflow = ((this.b & (1 << 6)) >> 6) ^ ((this.b & (1 << 5)) >> 5)`);
    }

    private AXS():Mc {
        // Sets X to {(A AND X) - #value without borrow}, and updates NZC. 

        return new McNop()
            .then(`const res = (this.rA & this.rX) + 256 - this.b`)
            .then(`this.rX = res & 0xff`)
            .then(`this.flgNegative = (this.rX & 128) !== 0 ? 1 : 0`)
            .then(`this.flgCarry = res > 255 ? 1 : 0`)
            .then(`this.flgZero = this.rX === 0 ? 1 : 0`);

    }

    private SYA(): Mc {
        //not implemented
        return new McNop();
    }

    private SXA(): Mc {
        //not implemented
        return new McNop();
    }
    private XAA(): Mc {
        //not implemented
        return new McNop();
    }

    private AXA(): Mc {
        //not implemented
        return new McNop();
    }
    private XAS(): Mc {
        //not implemented
        return new McNop();
    }
    private LAR(): Mc {
        //not implemented
        return new McNop();
    }

    //http://nesdev.com/6502_cpu.txt

    private getZeroPageCycles(statement: Statement, mc: Mc, mcPost: Mc): Cycle[] {
        switch(statement.memoryAccessPattern) {
            case MemoryAccessPattern.Read:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch address, increment PC')
                        .then(`this.addr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(mc)
                        .thenMoveBToReg(statement.regOut)
                        .thenNextStatement(),
                ];
             
            case MemoryAccessPattern.ReadModifyWrite:
            case MemoryAccessPattern.ReadModifyWriteAndModifyRegister:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch address, increment PC')
                        .then(`this.addr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenNextCycle(),

                    new Cycle(4, 'write the value back to effective address, and do the operation on it')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mc)
                        .thenNextCycle(),

                    new Cycle(5, 'write the new value to effective address')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mcPost)
                        .thenNextStatement()
                ];

            case MemoryAccessPattern.Write:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch address, increment PC')
                        .then(`this.addr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'write register to effective address')
                        .then(mc)
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .thenNextStatement(),
                ];
            default:
                throw 'not implemented';
        }
    }
    
    private getZeroPageXYCycles(reg:Register, statement: Statement, mc:Mc, mcPost:Mc): Cycle[] {

        var regAccess = this.getRegAccess(reg);

        switch (statement.memoryAccessPattern) {
            case MemoryAccessPattern.Read:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch address, increment PC')
                        .then(`this.addr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'read from address, add index register to it')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(`this.addr = (${regAccess} + this.addr) & 0xff`)
                        .thenNextCycle(),

                    new Cycle(4, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(mc)
                        .thenMoveBToReg(statement.regOut)
                        .thenNextStatement()
                ];

            case MemoryAccessPattern.ReadModifyWrite:
            case MemoryAccessPattern.ReadModifyWriteAndModifyRegister:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch address, increment PC')
                        .then(`this.addr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'read from address, add index register X/Y to it')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(`this.addr = (${regAccess} + this.addr) & 0xff`)
                        .thenNextCycle(),

                    new Cycle(4, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenNextCycle(),

                    new Cycle(5, 'write the value back to effective address, and do the operation on it')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mc)
                        .thenNextCycle(),

                    new Cycle(6, 'write the new value to effective address')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mcPost)
                        .thenNextStatement()
                ];
            case MemoryAccessPattern.Write:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch address, increment PC')
                        .then(`this.addr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'read from address, add index register X/Y to it')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(`this.addr = (${regAccess} + this.addr) & 0xff`)
                        .thenNextCycle(),

                    new Cycle(3, 'write register to effective address')
                        .then(mc)
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .thenNextStatement()
                ]
            default:
                throw 'not implemented';
        }
    }

    private getZeroPageXCycles(statement: Statement, mc: Mc, mcPost:Mc): Cycle[] {
        return this.getZeroPageXYCycles(Register.X, statement, mc, mcPost);
    }
    private getZeroPageYCycles(statement: Statement, mc: Mc, mcPost:Mc): Cycle[] {
        return this.getZeroPageXYCycles(Register.Y, statement, mc, mcPost);
    }

    private getAbsoluteCycles(statement: Statement, mc: Mc, mcPost: Mc): Cycle[] {

        switch (statement.memoryAccessPattern) {
            case MemoryAccessPattern.Jmp:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch low byte of address, increment PC')
                        .then(`this.addrLo = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'copy low address byte to PCL, fetch high address byte to PCH')
                        .then(`this.addrHi = this.memory.getByte(this.ip)`)
                        .then(`this.ip = (this.addrHi << 8) + this.addrLo`).withDummyPcIncrement()
                        .thenNextStatement()
                ];
            case MemoryAccessPattern.Read:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch low byte of address, increment PC')
                        .then(`this.addrLo = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch high byte of address, increment PC')
                        .then(`this.addrHi = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(4, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(mc)
                        .thenMoveBToReg(statement.regOut)
                        .thenNextStatement()
                ];
            case MemoryAccessPattern.ReadModifyWrite:
            case MemoryAccessPattern.ReadModifyWriteAndModifyRegister:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch low byte of address, increment PC')
                        .then(`this.addrLo = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch high byte of address, increment PC')
                        .then(`this.addrHi = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(4, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenNextCycle(),

                    new Cycle(5, 'write the value back to effective address, and do the operation on it')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mc)
                        .thenNextCycle(),

                    new Cycle(6, 'write the new value to effective address')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mcPost)
                        .thenNextStatement()
                ];
            case MemoryAccessPattern.Write:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch low byte of address, increment PC')
                        .then(`this.addrLo = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch high byte of address, increment PC')
                        .then(`this.addrHi = this.memory.getByte(this.ip)`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(4, 'write register to effective address')
                        .then(mc)
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .thenNextStatement()
                ];
            default:
                throw 'not implemented';
        }
    }

    private getAbsoluteIndirectCycles(statement: Statement, mc: Mc): Cycle[] {
        switch (statement.memoryAccessPattern) {
            case MemoryAccessPattern.Jmp:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch low byte of address, increment PC')
                        .then(`this.ptrLo = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'copy low address byte to PCL, fetch high address byte to PCH')
                        .then(`this.ptrHi = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),
                    
                    new Cycle(4, 'fetch low address to latch')
                        .then(`this.addrLo = this.memory.getByte( (this.ptrHi << 8) + this.ptrLo )`)
                        .thenNextCycle(),

                    new Cycle(4, 'fetch PCH copy latch to PCL')
                        .then(`this.addrHi = this.memory.getByte( (this.ptrHi << 8) + ((this.ptrLo + 1) & 0xff) )`)
                        .then(`this.ip = (this.addrHi << 8) + this.addrLo`)
                        .thenNextStatement()
                ];
            default:
                throw 'not implemented';
        }
    }

    private getAbsoluteXYCycles(rXY: string, statement: Statement, mc: Mc, mcPost: Mc): Cycle[] {

        switch (statement.memoryAccessPattern) {
            case MemoryAccessPattern.Read:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch low byte of address, increment PC')
                        .then(`this.addrLo = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch high byte of address, add index register to low address byte, increment PC')
                        .then(`this.addrHi = this.memory.getByte(this.ip)`)
                        .then(`this.addrC = (this.addrLo + this.${rXY}) >> 8`)
                        .then(`this.addrLo = (this.addrLo + this.${rXY}) & 0xff`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(4, 'read from effective address, fix the high byte of effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenIf({
                            cond: `this.addrC`,
                            if: `this.addr = this.addr + (this.addrC << 8)`,
                            else: mc.thenMoveBToReg(statement.regOut).thenNextStatement()
                        })
                        .thenNextCycle(),

                    new Cycle(5, 're-read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(mc)
                        .thenMoveBToReg(statement.regOut)
                        .thenNextStatement()
                 
                ];
            case MemoryAccessPattern.ReadModifyWrite:
            case MemoryAccessPattern.ReadModifyWriteAndModifyRegister:
               return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch low byte of address, increment PC')
                        .then(`this.addrLo = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch high byte of address, add index register to low address byte, increment PC')
                        .then(`this.addrHi = this.memory.getByte(this.ip)`)
                        .then(`this.addrC = (this.addrLo + this.${rXY}) >> 8`)
                        .then(`this.addrLo = (this.addrLo + this.${rXY}) & 0xff`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(4, 'read from effective address, fix the high byte of effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenIf({
                            cond: `this.addrC`,
                            if: `this.addr = this.addr + (this.addrC << 8)`
                        })
                        .thenNextCycle(),

                    new Cycle(5, 're-read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenNextCycle(),
                    
                    new Cycle(6, 'write the value back to effective address, and do the operation on it')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mc)
                        .thenNextCycle(),

                    new Cycle(7, 'write the new value to effective address')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mcPost)
                        .thenNextStatement()

                ];
            case MemoryAccessPattern.Write:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch low byte of address, increment PC')
                        .then(`this.addrLo = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch high byte of address, add index register to low address byte, increment PC')
                        .then(`this.addrHi = this.memory.getByte(this.ip)`)
                        .then(`this.addrC = (this.addrLo + this.${rXY}) >> 8`)
                        .then(`this.addrLo = (this.addrLo + this.${rXY}) & 0xff`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(4, 'read from effective address, fix the high byte of effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenIf({
                            cond: `this.addrC`,
                            if: `this.addr = this.addr + (this.addrC << 8)`,
                        })
                        .thenNextCycle(),

                    new Cycle(5, 'write to effective address')
                        .then(mc)
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .thenNextStatement()

                ];
            default:
                throw 'not implemented';
        }


    }

    private getAbsoluteXCycles(statement: Statement, mc: Mc, mcPost: Mc): Cycle[] {
        return this.getAbsoluteXYCycles('rX', statement, mc, mcPost);
    }

    private getAbsoluteYCycles(statement: Statement, mc: Mc, mcPost: Mc): Cycle[] {
        return this.getAbsoluteXYCycles('rY', statement, mc, mcPost);
    }

    private getImmediateCycles(statement: Statement, mc: Mc): Cycle[] {
        return [
            new Cycle(1, 'fetch opcode, increment PC')
                .fetchOpcode()
                .thenIncrementPC()
                .thenNextCycle(),

            new Cycle(2, 'fetch value, increment PC')
                .then(`this.b = this.memory.getByte(this.ip)`)
                .thenIncrementPC()
                .then(mc)
                .thenMoveBToReg(statement.regOut)
                .thenNextStatement()
        ];
    }

    private getAccumulatorCycles(statement: Statement, mc: Mc): Cycle[] {
        return [
            new Cycle(1, 'fetch opcode, increment PC')
                .fetchOpcode()
                .thenIncrementPC()
                .thenNextCycle(),
            new Cycle(2, ' read next instruction byte (and throw it away)')
                .then(`this.memory.getByte(this.ip)`)
                .thenMoveRegToB(statement.regIn)
                .then(mc)
                .thenMoveBToReg(statement.regOut)
                .thenNextStatement()
        ];
    }

    private JSR() { return null; }
    private getJSRCycles(statement: Statement, mc: Mc): Cycle[] {
        return [
            new Cycle(1, 'fetch opcode, increment PC')
                .fetchOpcode()
                .thenIncrementPC()
                .thenNextCycle(),
            new Cycle(2, 'fetch low address byte, increment PC')
                .then(`this.addrLo = this.memory.getByte(this.ip)`)
                .thenIncrementPC()
                .thenNextCycle(),
            new Cycle(3, 'internal operation (predecrement S?)')
                .thenNextCycle(),
            new Cycle(4, 'push PCH on stack, decrement S')
                .then(`this.pushByte(this.ip >> 8)`)
                .thenNextCycle(),
            new Cycle(5, 'push PCL on stack, decrement S')
                .then(`this.pushByte(this.ip & 0xff)`)
                .thenNextCycle(),
            new Cycle(6, 'copy low address byte to PCL, fetch high address byte to PCH')
                .then(`this.ip = this.addrLo`)
                .then(`this.ip |= this.memory.getByte(this.ip) << 8`).withDummyPcIncrement()
                .thenNextStatement()
        ];
    }

    private RTS() { return null; }
    private getRTSCycles(statement: Statement, mc: Mc): Cycle[] {
        return [
            new Cycle(1, 'fetch opcode, increment PC')
                .fetchOpcode()
                .thenIncrementPC()
                .thenNextCycle(),
            new Cycle(2, 'read next instruction byte (and throw it away)')
                .then(`this.memory.getByte(this.ip)`)
                .thenNextCycle(),
            new Cycle(3, 'increment S')
                .thenNextCycle(),
            new Cycle(4, 'pull PCL from stack, increment SS')
                .then(`this.ip = this.popByte()`)
                .thenNextCycle(),
            new Cycle(5, 'pull PCH from stack')
                .then(`this.ip |= this.popByte() << 8`)
                .thenNextCycle(),
            new Cycle(6, 'increment PCH')
                .thenIncrementPC()
                .thenNextStatement()
        ];
    }


    private BRK() { return null; }
    private getBRKCycles(statement: Statement, mc: Mc): Cycle[] {
        return [
            new Cycle(1, 'fetch opcode, increment PC')
                .fetchOpcode()
                .thenIncrementPC()
                .thenNextCycle(),
            new Cycle(2, 'read next instruction byte (and throw it away), inrement PC')
                .then(`this.memory.getByte(this.ip)`)
                .thenIncrementPC()
                .thenNextCycle(),
            new Cycle(3, 'push PCH on stack (with B flag set), decrement S')
                .then(`this.pushByte(this.ip >> 8)`)
                .thenNextCycle(),
            new Cycle(4, 'push PCL on stack, decrement S')
                .then(`this.pushByte(this.ip & 0xff)`)
                .thenNextCycle(),
            new Cycle(5, 'push P on stack, decrement S')
                .then(`this.flgBreakCommand = 1`)
                .then(`this.pushByte(this.rP)`)
                .then(`this.flgBreakCommand = 0`)
                .thenNextCycle(),
            new Cycle(6, 'fetch PCL')
                .then(`this.ip = this.memory.getByte(this.addrIRQ)`)
                .thenNextCycle(),
            new Cycle(7, 'fetch PCH')
                .then(`this.ip |= this.memory.getByte(this.addrIRQ + 1) << 8`)
                .thenNextStatement()
        ];
    }

    private RTI() { return null; }
    private getRTICycles(statement: Statement, mc: Mc): Cycle[] {
        return [
            new Cycle(1, 'fetch opcode, increment PC')
                .fetchOpcode()
                .thenIncrementPC()
                .thenNextCycle(),
            new Cycle(2, 'read next instruction byte (and throw it away)')
                .then(`this.memory.getByte(this.ip)`)
                .thenNextCycle(),
            new Cycle(3, 'increment S')
                .thenNextCycle(),
            new Cycle(4, 'pull P from stack, increment S')
                .then(`this.rP = this.popByte()`)
                .thenNextCycle(),
            new Cycle(5, ' pull PCL from stack, increment SL')
                .then(`this.ip = this.popByte()`)
                .thenNextCycle(),
            new Cycle(6, ' pull PCH from stack')
                .then(`this.ip |= this.popByte() << 8`)
                .thenNextStatement()
        ];
    }

    private getImpliedCycles(statement: Statement, mc: Mc): Cycle[] {

        switch (statement.memoryAccessPattern) {
            case MemoryAccessPattern.Push:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),
                    new Cycle(2, 'read next instruction byte (and throw it away)')
                        .then(`this.memory.getByte(this.ip)`)
                        .thenNextCycle(),
                    new Cycle(3, 'push register on stack, decrement S)')
                        .then(mc)
                        .thenNextStatement()
                ];
            case MemoryAccessPattern.Pop:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),
                    new Cycle(2, 'read next instruction byte (and throw it away)')
                        .then(`this.memory.getByte(this.ip)`)
                        .thenNextCycle(),
                    new Cycle(3, 'increment S')
                        .thenNextCycle(),
                    new Cycle(4, 'pull register from stack')
                        .then(mc)
                        .thenNextStatement()
                ];
            default:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),
                    new Cycle(2, 'read next instruction byte (and throw it away)')
                        .then(`this.memory.getByte(this.ip)`)
                        .then(mc)
                        .thenNextStatement()
                ];
           }
    }

    private getIndirectXCycles(statement: Statement, mc: Mc, mcPost: Mc): Cycle[] {
        switch (statement.memoryAccessPattern) {
            case MemoryAccessPattern.Read:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch pointer address, increment PC')
                        .then(`this.addrPtr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'read from the address, add X to it')
                        .then(`this.addrPtr = (this.memory.getByte(this.addrPtr) + this.rX) & 0xff`)
                        .thenNextCycle(),

                    new Cycle(4, 'fetch effective address low')
                        .then(`this.addrLo = this.memory.getByte(this.addrPtr)`)
                        .thenNextCycle(),

                    new Cycle(5, 'fetch effective address high')
                        .then(`this.addrHi = this.memory.getByte((this.addrPtr + 1) & 0xff)`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenNextCycle(),
                    
                    new Cycle(6, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(mc)
                        .thenMoveBToReg(statement.regOut)
                        .thenNextStatement()
                ];
            case MemoryAccessPattern.ReadModifyWrite:
            case MemoryAccessPattern.ReadModifyWriteAndModifyRegister:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch pointer address, increment PC')
                        .then(`this.addrPtr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'read from the address, add X to it')
                        .then(`this.addrPtr = (this.memory.getByte(this.addrPtr) + this.rX) & 0xff`)
                        .thenNextCycle(),

                    new Cycle(4, 'fetch effective address low')
                        .then(`this.addrLo = this.memory.getByte(this.addrPtr)`)
                        .thenNextCycle(),

                    new Cycle(5, 'fetch effective address high')
                        .then(`this.addrHi = this.memory.getByte((this.addrPtr + 1) & 0xff)`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenNextCycle(),

                    new Cycle(6, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenNextCycle(),

                    new Cycle(7, 'write the value back to effective address, and do the operation on it')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mc)
                        .thenNextCycle(),

                    new Cycle(8, 'write the new value to effective address')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mcPost)
                        .thenNextStatement()
                ];
            case MemoryAccessPattern.Write:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch pointer address, increment PC')
                        .then(`this.addrPtr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'read from the address, add X to it')
                        .then(`this.addrPtr = (this.memory.getByte(this.addrPtr) + this.rX) & 0xff`)
                        .thenNextCycle(),

                    new Cycle(4, 'fetch effective address low')
                        .then(`this.addrLo = this.memory.getByte(this.addrPtr)`)
                        .thenNextCycle(),

                    new Cycle(5, 'fetch effective address high')
                        .then(`this.addrHi = this.memory.getByte((this.addrPtr + 1) & 0xff)`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenNextCycle(),

                    new Cycle(6, 'write to effective address')
                        .then(mc)
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .thenNextStatement()
                ];
            default:
                throw 'not implemented';
        }
    }

    private getIndirectYCycles(statement: Statement, mc: Mc, mcPost : Mc): Cycle[] {
        switch (statement.memoryAccessPattern) {
            case MemoryAccessPattern.Read:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch pointer address, increment PC')
                        .then(`this.addrPtr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch effective address low')
                        .then(`this.addrLo = this.memory.getByte(this.addrPtr)`)
                        .thenNextCycle(),

                    new Cycle(4, 'fetch effective address high, add Y to low byte of effective address')
                        .then(`this.addrHi = this.memory.getByte((this.addrPtr + 1) & 0xff)`)
                        .then(`this.addrC = (this.addrLo + this.rY) >> 8`)
                        .then(`this.addrLo = (this.addrLo + this.rY) & 0xff`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenNextCycle(),

                    new Cycle(5, 'read from effective address, fix high byte of effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenIf({
                            cond: `this.addrC`,
                            if: `this.addr = this.addr + (this.addrC << 8)`,
                            else: mc.thenMoveBToReg(statement.regOut).thenNextStatement()
                        })
                        .thenNextCycle(),

                    new Cycle(6, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .then(mc)
                        .thenMoveBToReg(statement.regOut)
                        .thenNextStatement()
                ];
            case MemoryAccessPattern.ReadModifyWrite:
            case MemoryAccessPattern.ReadModifyWriteAndModifyRegister:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch pointer address, increment PC')
                        .then(`this.addrPtr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch effective address low')
                        .then(`this.addrLo = this.memory.getByte(this.addrPtr)`)
                        .thenNextCycle(),

                    new Cycle(4, 'fetch effective address high, add Y to low byte of effective address')
                        .then(`this.addrHi = this.memory.getByte((this.addrPtr + 1) & 0xff)`)
                        .then(`this.addrC = (this.addrLo + this.rY) >> 8`)
                        .then(`this.addrLo = (this.addrLo + this.rY) & 0xff`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenNextCycle(),

                    new Cycle(5, 'read from effective address, fix high byte of effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenIf({
                            cond: `this.addrC`,
                            if: `this.addr = this.addr + (this.addrC << 8)`,
                        })
                        .thenNextCycle(),

                    new Cycle(6, 'read from effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenNextCycle(),
                    
                    new Cycle(7, 'write the value back to effective address, and do the operation on it')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mc)
                        .thenNextCycle(),

                    new Cycle(8, 'write the new value to effective address')
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .then(mcPost)
                        .thenNextStatement()

                ];

            case MemoryAccessPattern.Write:
                return [
                    new Cycle(1, 'fetch opcode, increment PC')
                        .fetchOpcode()
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(2, 'fetch pointer address, increment PC')
                        .then(`this.addrPtr = this.memory.getByte(this.ip)`)
                        .thenIncrementPC()
                        .thenNextCycle(),

                    new Cycle(3, 'fetch effective address low')
                        .then(`this.addrLo = this.memory.getByte(this.addrPtr)`)
                        .thenNextCycle(),

                    new Cycle(4, 'fetch effective address high, add Y to low byte of effective address')
                        .then(`this.addrHi = this.memory.getByte((this.addrPtr + 1) & 0xff)`)
                        .then(`this.addrC = (this.addrLo + this.rY) >> 8`)
                        .then(`this.addrLo = (this.addrLo + this.rY) & 0xff`)
                        .then(`this.addr = this.addrLo + (this.addrHi << 8)`)
                        .thenNextCycle(),

                    new Cycle(5, 'read from effective address, fix high byte of effective address')
                        .then(`this.b = this.memory.getByte(this.addr)`)
                        .thenIf({
                            cond: `this.addrC`,
                            if: `this.addr = this.addr + (this.addrC << 8)`,
                        })
                        .thenNextCycle(),

                    new Cycle(6, 'write to effective address')
                        .then(mc)
                        .then(`this.memory.setByte(this.addr, this.b)`)
                        .thenNextStatement()
                ];
            default:
                throw 'not implemented';
        }
    }

    private getRelativeCycles(statement: Statement, mc: McExpr): Cycle[] {
        return [
            new Cycle(1, 'fetch opcode, increment PC')
                .fetchOpcode()
                .thenIncrementPC()
                .thenNextCycle(),

            new Cycle(2, 'fetch operand, increment PC')
                .then(`this.b = this.memory.getByte(this.ip)`)
                .thenIncrementPC()
                .thenIf({
                    cond: mc.expr,
                    if: new McNextCycle(),
                    else: new McNextStatement()
                }),

            new Cycle(3, 'fetch opcode of next instruction, if branch is taken add operand to pc')
                .then(`this.memory.getByte(this.ip)`)
                .then(`this.b = this.b >= 128 ? this.b - 256 : this.b`)
                .then(`this.ipC = (this.ip & 0xff) + this.b >> 8`)
                .then(`this.ip += this.b`)
                .thenIf({
                    cond: 'this.ipC',
                    if: new McNextCycle(),
                    else: new McNextStatement()
                }),

            new Cycle(4, 'Fix PCH.')
                .then(`this.ip += this.ipC << 8`)
                .thenNextStatement()
        ];
    }

    private genStatement(statement:Statement) {
        var ctx = new Ctx();

        ctx.writeLine(`case 0x${statement.opcode.toString(16)}: /* ${statement.mnemonic} ${statement.cycleCount.toString()} */ {`);
        ctx.indent();
        var rgcycle = statement.getCycles(this);
    
        ctx.writeLine('switch (this.t) {');
        ctx.indented(() => {
            for (let icycle = 0; icycle < rgcycle.length; icycle++) {
                var cycle = rgcycle[icycle];

                ctx.writeLine(`case ${icycle}: {`);
                ctx.indented(() => {
                    cycle.mc.write(ctx);
                    ctx.writeLine('break;');
                });
                ctx.writeLine(`}`);
            }
        });
        ctx.writeLine('}');
        
        ctx.writeLine('break;');
        ctx.unindent();
        ctx.writeLine('}');
        var res = ctx.getOutput();
        if (rgcycle.length !== statement.cycleCount.maxCycle()) {
            console.error(`${statement.mnemonic}: cycle count doesn't match. Expected ${statement.cycleCount.maxCycle()}, found ${rgcycle.length}`);
            console.error(res);
            throw '';
        }

        if (rgcycle.map(cycle=> cycle.pcIncremented).reduce((s, pcIncremented) => s + pcIncremented) !== statement.size) {
            console.error(`${statement.mnemonic}: size mismatch. Expected to be ${statement.size} long`);
            console.error(res);
            throw '';
        }
        return res;
    }
    
    run() {

        var statements = [
            new Statement(0x69, StatementKind.ADC, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x65, StatementKind.ADC, AddressingMode.ZeroPage , 2, new CycleCount(3)),
            new Statement(0x75, StatementKind.ADC, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x6d, StatementKind.ADC, AddressingMode.Absolute , 3, new CycleCount(4)),
            new Statement(0x7d, StatementKind.ADC, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0x79, StatementKind.ADC, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),
            new Statement(0x61, StatementKind.ADC, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0x71, StatementKind.ADC, AddressingMode.IndirectY, 2, new CycleCount(5).withPageCross()),
      
            new Statement(0x29, StatementKind.AND, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x25, StatementKind.AND, AddressingMode.ZeroPage , 2, new CycleCount(3)),
            new Statement(0x35, StatementKind.AND, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x2d, StatementKind.AND, AddressingMode.Absolute , 3, new CycleCount(4)),
            new Statement(0x3d, StatementKind.AND, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0x39, StatementKind.AND, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),
            new Statement(0x21, StatementKind.AND, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0x31, StatementKind.AND, AddressingMode.IndirectY, 2, new CycleCount(5).withPageCross()),

            new Statement(0x0a, StatementKind.ASL, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0x06, StatementKind.ASL, AddressingMode.ZeroPage   , 2, new CycleCount(5)),
            new Statement(0x16, StatementKind.ASL, AddressingMode.ZeroPageX  , 2, new CycleCount(6)),
            new Statement(0x0e, StatementKind.ASL, AddressingMode.Absolute   , 3, new CycleCount(6)),
            new Statement(0x1e, StatementKind.ASL, AddressingMode.AbsoluteX  , 3, new CycleCount(7)),

            new Statement(0x90, StatementKind.BCC, AddressingMode.Relative, 2, new CycleCount(2).withBranchTaken().withPageCross()),
            new Statement(0xb0, StatementKind.BCS, AddressingMode.Relative, 2, new CycleCount(2).withBranchTaken().withPageCross()),
            new Statement(0xf0, StatementKind.BEQ, AddressingMode.Relative, 2, new CycleCount(2).withBranchTaken().withPageCross()),
            new Statement(0x30, StatementKind.BMI, AddressingMode.Relative, 2, new CycleCount(2).withBranchTaken().withPageCross()),
            new Statement(0xd0, StatementKind.BNE, AddressingMode.Relative, 2, new CycleCount(2).withBranchTaken().withPageCross()),
            new Statement(0x10, StatementKind.BPL, AddressingMode.Relative, 2, new CycleCount(2).withBranchTaken().withPageCross()),
            new Statement(0x50, StatementKind.BVC, AddressingMode.Relative, 2, new CycleCount(2).withBranchTaken().withPageCross()),
            new Statement(0x70, StatementKind.BVS, AddressingMode.Relative, 2, new CycleCount(2).withBranchTaken().withPageCross()),


            new Statement(0x24, StatementKind.BIT, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x2c, StatementKind.BIT, AddressingMode.Absolute, 3, new CycleCount(4)),

            new Statement(0x18, StatementKind.CLC, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0xd8, StatementKind.CLD, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0x58, StatementKind.CLI, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0xb8, StatementKind.CLV, AddressingMode.Implied, 1, new CycleCount(2)),

            new Statement(0xc9, StatementKind.CMP, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xc5, StatementKind.CMP, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0xd5, StatementKind.CMP, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0xcd, StatementKind.CMP, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0xdd, StatementKind.CMP, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0xd9, StatementKind.CMP, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),
            new Statement(0xc1, StatementKind.CMP, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0xd1, StatementKind.CMP, AddressingMode.IndirectY, 2, new CycleCount(5).withPageCross()),
            new Statement(0xe0, StatementKind.CPX, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xe4, StatementKind.CPX, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0xec, StatementKind.CPX, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0xc0, StatementKind.CPY, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xc4, StatementKind.CPY, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0xcc, StatementKind.CPY, AddressingMode.Absolute, 3, new CycleCount(4)),

            new Statement(0xc6, StatementKind.DEC, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0xd6, StatementKind.DEC, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0xce, StatementKind.DEC, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0xde, StatementKind.DEC, AddressingMode.AbsoluteX, 3, new CycleCount(7)),
            new Statement(0xca, StatementKind.DEX, AddressingMode.Accumulator, 1, new CycleCount(2)), 
            new Statement(0x88, StatementKind.DEY, AddressingMode.Accumulator, 1, new CycleCount(2)),

            new Statement(0xe6, StatementKind.INC, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0xf6, StatementKind.INC, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0xee, StatementKind.INC, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0xfe, StatementKind.INC, AddressingMode.AbsoluteX, 3, new CycleCount(7)),
            new Statement(0xe8, StatementKind.INX, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0xc8, StatementKind.INY, AddressingMode.Accumulator, 1, new CycleCount(2)),
            
            new Statement(0x49, StatementKind.EOR, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x45, StatementKind.EOR, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x55, StatementKind.EOR, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x4D, StatementKind.EOR, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0x5D, StatementKind.EOR, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0x59, StatementKind.EOR, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),
            new Statement(0x41, StatementKind.EOR, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0x51, StatementKind.EOR, AddressingMode.IndirectY, 2, new CycleCount(5).withPageCross()),

            new Statement(0x4c, StatementKind.JMP, AddressingMode.Absolute, 3, new CycleCount(3)),
            new Statement(0x6c, StatementKind.JMP, AddressingMode.AbsoluteIndirect, 3, new CycleCount(5)),

            new Statement(0xa9, StatementKind.LDA, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xa5, StatementKind.LDA, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0xb5, StatementKind.LDA, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0xad, StatementKind.LDA, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0xbd, StatementKind.LDA, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0xb9, StatementKind.LDA, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),
            new Statement(0xa1, StatementKind.LDA, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0xb1, StatementKind.LDA, AddressingMode.IndirectY, 2, new CycleCount(5).withPageCross()),

            new Statement(0xa2, StatementKind.LDX, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xa6, StatementKind.LDX, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0xb6, StatementKind.LDX, AddressingMode.ZeroPageY, 2, new CycleCount(4)),
            new Statement(0xae, StatementKind.LDX, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0xbe, StatementKind.LDX, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),

            new Statement(0xa0, StatementKind.LDY, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xa4, StatementKind.LDY, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0xb4, StatementKind.LDY, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0xac, StatementKind.LDY, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0xbc, StatementKind.LDY, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),

            new Statement(0x4a, StatementKind.LSR, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0x46, StatementKind.LSR, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0x56, StatementKind.LSR, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0x4e, StatementKind.LSR, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0x5e, StatementKind.LSR, AddressingMode.AbsoluteX, 3, new CycleCount(7)),

            new Statement(0xea, StatementKind.NOP, AddressingMode.Implied, 1, new CycleCount(2)),

            new Statement(0x09, StatementKind.ORA, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x05, StatementKind.ORA, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x15, StatementKind.ORA, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x0d, StatementKind.ORA, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0x1d, StatementKind.ORA, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0x19, StatementKind.ORA, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),
            new Statement(0x01, StatementKind.ORA, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0x11, StatementKind.ORA, AddressingMode.IndirectY, 2, new CycleCount(5).withPageCross()),

            new Statement(0x48, StatementKind.PHA, AddressingMode.Implied, 1, new CycleCount(3)),
            new Statement(0x08, StatementKind.PHP, AddressingMode.Implied, 1, new CycleCount(3)),
            new Statement(0x68, StatementKind.PLA, AddressingMode.Implied, 1, new CycleCount(4)),
            new Statement(0x28, StatementKind.PLP, AddressingMode.Implied, 1, new CycleCount(4)),


            new Statement(0x2a, StatementKind.ROL, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0x26, StatementKind.ROL, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0x36, StatementKind.ROL, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0x2e, StatementKind.ROL, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0x3e, StatementKind.ROL, AddressingMode.AbsoluteX, 3, new CycleCount(7)),

            new Statement(0x6a, StatementKind.ROR, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0x66, StatementKind.ROR, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0x76, StatementKind.ROR, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0x6e, StatementKind.ROR, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0x7e, StatementKind.ROR, AddressingMode.AbsoluteX, 3, new CycleCount(7)),

            new Statement(0x00, StatementKind.BRK, AddressingMode.BRK, 2, new CycleCount(7)),
            new Statement(0x40, StatementKind.RTI, AddressingMode.RTI, 1, new CycleCount(6)),

            new Statement(0xe9, StatementKind.SBC, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xe5, StatementKind.SBC, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0xf5, StatementKind.SBC, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0xed, StatementKind.SBC, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0xfd, StatementKind.SBC, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0xf9, StatementKind.SBC, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),
            new Statement(0xe1, StatementKind.SBC, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0xf1, StatementKind.SBC, AddressingMode.IndirectY, 2, new CycleCount(5).withPageCross()),

            new Statement(0x38, StatementKind.SEC, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0xf8, StatementKind.SED, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0x78, StatementKind.SEI, AddressingMode.Implied, 1, new CycleCount(2)),

            new Statement(0x85, StatementKind.STA, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x95, StatementKind.STA, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x8d, StatementKind.STA, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0x9d, StatementKind.STA, AddressingMode.AbsoluteX, 3, new CycleCount(5)),
            new Statement(0x99, StatementKind.STA, AddressingMode.AbsoluteY, 3, new CycleCount(5)),
            new Statement(0x81, StatementKind.STA, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0x91, StatementKind.STA, AddressingMode.IndirectY, 2, new CycleCount(6)),

            new Statement(0x86, StatementKind.STX, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x96, StatementKind.STX, AddressingMode.ZeroPageY, 2, new CycleCount(4)),
            new Statement(0x8e, StatementKind.STX, AddressingMode.Absolute, 3, new CycleCount(4)),

            new Statement(0x84, StatementKind.STY, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x94, StatementKind.STY, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x8c, StatementKind.STY, AddressingMode.Absolute, 3, new CycleCount(4)),

            new Statement(0xaa, StatementKind.TAX, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0xa8, StatementKind.TAY, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0xba, StatementKind.TSX, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0x8a, StatementKind.TXA, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0x9a, StatementKind.TXS, AddressingMode.Accumulator, 1, new CycleCount(2)),
            new Statement(0x98, StatementKind.TYA, AddressingMode.Accumulator, 1, new CycleCount(2)),

            new Statement(0x20, StatementKind.JSR, AddressingMode.JSR, 3, new CycleCount(6)),
            new Statement(0x60, StatementKind.RTS, AddressingMode.RTS, 2, new CycleCount(6)),

            //unofficial opcodes

            new Statement(0x1a, StatementKind.NOP, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0x3a, StatementKind.NOP, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0x5a, StatementKind.NOP, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0x7a, StatementKind.NOP, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0xda, StatementKind.NOP, AddressingMode.Implied, 1, new CycleCount(2)),
            new Statement(0xfa, StatementKind.NOP, AddressingMode.Implied, 1, new CycleCount(2)),

            new Statement(0x04, StatementKind.NOP, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x14, StatementKind.NOP, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x34, StatementKind.NOP, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x44, StatementKind.NOP, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x54, StatementKind.NOP, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x74, StatementKind.NOP, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0xd4, StatementKind.NOP, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0xf4, StatementKind.NOP, AddressingMode.ZeroPageX, 2, new CycleCount(4)),
            new Statement(0x64, StatementKind.NOP, AddressingMode.ZeroPage, 2, new CycleCount(3)),

            new Statement(0x80, StatementKind.NOP, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x82, StatementKind.NOP, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xc2, StatementKind.NOP, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xe2, StatementKind.NOP, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x89, StatementKind.NOP, AddressingMode.Immediate, 2, new CycleCount(2)),

            new Statement(0x0c, StatementKind.NOP, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0x1c, StatementKind.NOP, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0x3c, StatementKind.NOP, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0x5c, StatementKind.NOP, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0x7c, StatementKind.NOP, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0xdc, StatementKind.NOP, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),
            new Statement(0xfc, StatementKind.NOP, AddressingMode.AbsoluteX, 3, new CycleCount(4).withPageCross()),

            new Statement(0xc3, StatementKind.DCP, AddressingMode.IndirectX, 2, new CycleCount(8)),
            new Statement(0xc7, StatementKind.DCP, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0xcf, StatementKind.DCP, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0xd3, StatementKind.DCP, AddressingMode.IndirectY, 2, new CycleCount(8)),
            new Statement(0xd7, StatementKind.DCP, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0xdb, StatementKind.DCP, AddressingMode.AbsoluteY, 3, new CycleCount(7)),
            new Statement(0xdf, StatementKind.DCP, AddressingMode.AbsoluteX, 3, new CycleCount(7)),
            
            new Statement(0xe3, StatementKind.ISC, AddressingMode.IndirectX, 2, new CycleCount(8)),
            new Statement(0xe7, StatementKind.ISC, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0xef, StatementKind.ISC, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0xf3, StatementKind.ISC, AddressingMode.IndirectY, 2, new CycleCount(8)),
            new Statement(0xf7, StatementKind.ISC, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0xfb, StatementKind.ISC, AddressingMode.AbsoluteY, 3, new CycleCount(7)),
            new Statement(0xff, StatementKind.ISC, AddressingMode.AbsoluteX, 3, new CycleCount(7)),

            new Statement(0xab, StatementKind.LAX, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xa7, StatementKind.LAX, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0xb7, StatementKind.LAX, AddressingMode.ZeroPageY, 2, new CycleCount(4)),
            new Statement(0xaf, StatementKind.LAX, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0xbf, StatementKind.LAX, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),
            new Statement(0xa3, StatementKind.LAX, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0xb3, StatementKind.LAX, AddressingMode.IndirectY, 2, new CycleCount(5).withPageCross()),

            new Statement(0x83, StatementKind.SAX, AddressingMode.IndirectX, 2, new CycleCount(6)),
            new Statement(0x87, StatementKind.SAX, AddressingMode.ZeroPage, 2, new CycleCount(3)),
            new Statement(0x8f, StatementKind.SAX, AddressingMode.Absolute, 3, new CycleCount(4)),
            new Statement(0x97, StatementKind.SAX, AddressingMode.ZeroPageY, 2, new CycleCount(4)),

            new Statement(0x03, StatementKind.SLO, AddressingMode.IndirectX, 2, new CycleCount(8)),
            new Statement(0x07, StatementKind.SLO, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0x0f, StatementKind.SLO, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0x13, StatementKind.SLO, AddressingMode.IndirectY, 2, new CycleCount(8)),
            new Statement(0x17, StatementKind.SLO, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0x1b, StatementKind.SLO, AddressingMode.AbsoluteY, 3, new CycleCount(7)),
            new Statement(0x1f, StatementKind.SLO, AddressingMode.AbsoluteX, 3, new CycleCount(7)),


            new Statement(0x23, StatementKind.RLA, AddressingMode.IndirectX, 2, new CycleCount(8)),
            new Statement(0x27, StatementKind.RLA, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0x2f, StatementKind.RLA, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0x33, StatementKind.RLA, AddressingMode.IndirectY, 2, new CycleCount(8)),
            new Statement(0x37, StatementKind.RLA, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0x3b, StatementKind.RLA, AddressingMode.AbsoluteY, 3, new CycleCount(7)),
            new Statement(0x3f, StatementKind.RLA, AddressingMode.AbsoluteX, 3, new CycleCount(7)),

            new Statement(0x63, StatementKind.RRA, AddressingMode.IndirectX, 2, new CycleCount(8)),
            new Statement(0x67, StatementKind.RRA, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0x6f, StatementKind.RRA, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0x73, StatementKind.RRA, AddressingMode.IndirectY, 2, new CycleCount(8)),
            new Statement(0x77, StatementKind.RRA, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0x7b, StatementKind.RRA, AddressingMode.AbsoluteY, 3, new CycleCount(7)),
            new Statement(0x7f, StatementKind.RRA, AddressingMode.AbsoluteX, 3, new CycleCount(7)),

            new Statement(0x43, StatementKind.SRE, AddressingMode.IndirectX, 2, new CycleCount(8)),
            new Statement(0x47, StatementKind.SRE, AddressingMode.ZeroPage, 2, new CycleCount(5)),
            new Statement(0x4f, StatementKind.SRE, AddressingMode.Absolute, 3, new CycleCount(6)),
            new Statement(0x53, StatementKind.SRE, AddressingMode.IndirectY, 2, new CycleCount(8)),
            new Statement(0x57, StatementKind.SRE, AddressingMode.ZeroPageX, 2, new CycleCount(6)),
            new Statement(0x5b, StatementKind.SRE, AddressingMode.AbsoluteY, 3, new CycleCount(7)),
            new Statement(0x5f, StatementKind.SRE, AddressingMode.AbsoluteX, 3, new CycleCount(7)),

            new Statement(0x0b, StatementKind.ANC, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x2b, StatementKind.ANC, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x4b, StatementKind.ALR, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x6b, StatementKind.ARR, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0xcb, StatementKind.AXS, AddressingMode.Immediate, 2, new CycleCount(2)),

            new Statement(0x9c, StatementKind.SYA, AddressingMode.AbsoluteX, 3, new CycleCount(5)),
            new Statement(0x9e, StatementKind.SXA, AddressingMode.AbsoluteY, 3, new CycleCount(5)),
            new Statement(0x8b, StatementKind.XAA, AddressingMode.Immediate, 2, new CycleCount(2)),
            new Statement(0x93, StatementKind.AXA, AddressingMode.IndirectY, 2, new CycleCount(6)),
            new Statement(0x9b, StatementKind.XAS, AddressingMode.AbsoluteY, 3, new CycleCount(5)),
            new Statement(0x9f, StatementKind.AXA, AddressingMode.AbsoluteY, 3, new CycleCount(5)),
            new Statement(0xbb, StatementKind.LAR, AddressingMode.AbsoluteY, 3, new CycleCount(4).withPageCross()),

        ];

        var res = `///<reference path="Memory.ts"/>

class Most6502Base {
    opcode: number;
    memory: Memory;
    ip: number = 0;
    sp: number = 0;
    t: number = 0;
    b: number = 0;
    rA: number = 0;
    rX: number = 0;
    rY: number = 0;

    private flgCarry: number = 0;
    private flgZero: number = 0;
    private flgNegative: number = 0;
    private flgOverflow: number = 0;
    private flgInterruptDisable: number = 1;
    private flgDecimalMode: number = 0;
    private flgBreakCommand: number = 0;

    addr: number;
    addrHi: number;
    addrLo: number;
    addrPtr: number;
    ptrLo: number;
    ptrHi: number;
    ipC: number;
    addrC: number;

    public addrReset = 0xfffc;
    public addrIRQ = 0xfffe;
    public addrNMI = 0xfffa;
  
    private pushByte(byte: number) {
        this.memory.setByte(0x100 + this.sp, byte & 0xff);
        this.sp = this.sp === 0 ? 0xff : this.sp - 1;
    }

    private popByte():number{
        this.sp = this.sp === 0xff ? 0 : this.sp + 1;
        return this.memory.getByte(0x100 + this.sp);
    }

    public get rP(): number {
        return (this.flgNegative << 7) +
            (this.flgOverflow << 6) +
            (1 << 5) +
            (this.flgBreakCommand << 4) +
            (this.flgDecimalMode << 3) +
            (this.flgInterruptDisable << 2) +
            (this.flgZero << 1) +
            (this.flgCarry << 0);
    }

    public set rP(byte: number) {
        this.flgNegative = (byte >> 7) & 1;
        this.flgOverflow = (byte >> 6) & 1;
        //skip (byte >> 5) & 1;
        //skip this.flgBreakCommand = (byte >> 4) & 1;
        this.flgBreakCommand = 0;
        this.flgDecimalMode = (byte >> 3) & 1;
        this.flgInterruptDisable = (byte >> 2) & 1;
        this.flgZero = (byte >> 1) & 1;
        this.flgCarry = (byte >> 0) & 1;
    }

    public clk() {

        if (this.t === 0) {
            this.opcode = this.memory.getByte(this.ip);
            this.addr = this.addrHi = this.addrLo = this.addrPtr = this.ptrLo = this.ptrHi = this.ipC = this.addrC = 0;
        }

        switch (this.opcode) {
`;

        for (let i=0;i<statements.length;i++) {
            res += this.genStatement(statements[i]);
        }

        res += `}
        }
    }
`;
        return res;
    }
}

