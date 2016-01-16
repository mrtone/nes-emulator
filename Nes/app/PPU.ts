﻿class PPU {
    
    /**
     *
        Address range	Size	Description
        $0000-$0FFF	$1000	Pattern table 0
        $1000-$1FFF	$1000	Pattern Table 1
        $2000-$23FF	$0400	Nametable 0
        $2400-$27FF	$0400	Nametable 1
        $2800-$2BFF	$0400	Nametable 2
        $2C00-$2FFF	$0400	Nametable 3
        $3000-$3EFF	$0F00	Mirrors of $2000-$2EFF
        $3F00-$3F1F	$0020	Palette RAM indexes
        $3F20-$3FFF	$00E0	Mirrors of $3F00-$3F1F

     */


    v:number = 0; // Current VRAM address (15 bits)
    t:number = 0; // Temporary VRAM address (15 bits); can also be thought of as the address of the top left onscreen tile.
    x:number = 0; // Fine X scroll (3 bits)
    w: number = 0; // First or second write toggle (1 bit)
    daddrWrite:number = 0;
    addrSpritePatternTable:number = 0;
    addrScreenPatternTable:number = 0;

    /**
     *The PPU uses the current VRAM address for both reading and writing PPU memory thru $2007, and for 
     * fetching nametable data to draw the background. As it's drawing the background, it updates the 
     * address to point to the nametable data currently being drawn. Bits 10-11 hold the base address of 
     * the nametable minus $2000. Bits 12-14 are the Y offset of a scanline within a tile.
        The 15 bit registers t and v are composed this way during rendering:
        yyy NN YYYYY XXXXX
        ||| || ||||| +++++-- coarse X scroll
        ||| || +++++-------- coarse Y scroll
        ||| ++-------------- nametable select
        +++----------------- fine Y scroll
     */

    spriteHeight = 8;
    vblankEnable = false;
    imageGrayscale = false;
    showBgInLeftmost8Pixels = false;
    showSpritesInLeftmost8Pixels = false;
    showBg = false;
    showSprites = false;
    emphasizeRed = false;
    emphasizeGreen = false;
    emphasizeBlue = false;

    constructor(memory: CompoundMemory, public vmemory: Memory) {
        if (vmemory.size() !== 0x4000)
            throw 'insufficient Vmemory size';

        memory.shadowSetter(0x2000, 0x2007, this.setter.bind(this));
        memory.shadowGetter(0x2000, 0x2007, this.getter.bind(this));
    }

    private getter(addr: number) {
        switch (addr) {
            case 0x2000:
                /*
                    7  bit  0
                    ---- ----
                    VSO. ....
                    |||| ||||
                    |||+-++++- Least significant bits previously written into a PPU register
                    |||        (due to register not being updated for this address)
                    ||+------- Sprite overflow. The intent was for this flag to be set
                    ||         whenever more than eight sprites appear on a scanline, but a
                    ||         hardware bug causes the actual behavior to be more complicated
                    ||         and generate false positives as well as false negatives; see
                    ||         PPU sprite evaluation. This flag is set during sprite
                    ||         evaluation and cleared at dot 1 (the second dot) of the
                    ||         pre-render line.
                    |+-------- Sprite 0 Hit.  Set when a nonzero pixel of sprite 0 overlaps
                    |          a nonzero background pixel; cleared at dot 1 of the pre-render
                    |          line.  Used for raster timing.
                    +--------- Vertical blank has started (0: not in vblank; 1: in vblank).
                               Set at dot 1 of line 241 (the line *after* the post-render
                               line); cleared after reading $2002 and at dot 1 of the
                               pre-render line.
                    Notes
                    Reading the status register will clear D7 mentioned above and also the address latch used by PPUSCROLL and PPUADDR. It does not clear the sprite 0 hit or overflow bit.
                    Once the sprite 0 hit flag is set, it will not be cleared until the end of the next vertical blank. If attempting to use this flag for raster timing, it is important to ensure that the sprite 0 hit check happens outside of vertical blank, otherwise the CPU will "leak" through and the check will fail. The easiest way to do this is to place an earlier check for D6 = 0, which will wait for the pre-render scanline to begin.
                    If using sprite 0 hit to make a bottom scroll bar below a vertically scrolling or freely scrolling playfield, be careful to ensure that the tile in the playfield behind sprite 0 is opaque.
                    Sprite 0 hit is not detected at x=255, nor is it detected at x=0 through 7 if the background or sprites are hidden in this area.
                    See: PPU rendering for more information on the timing of setting and clearing the flags.
                    Some Vs. System PPUs return a constant value in D4-D0 that the game checks.
                    Caution: Reading PPUSTATUS at the exact start of vertical blank will return 0 in bit 7 but clear the latch anyway, causing the program to miss frames. See NMI for details*/
                this.w = 0;
                return 0;
            default:
                return 0;
        }
    }

    private setter(addr: number, value: number) {
        value &= 0xff;

        /*$0x2006 Used to set the address of PPU Memory to be accessed via
          $2007. The first write to this register will set 8 lower
          address bits. The second write will set 6 upper bits. The
          address will increment either by 1 or by 32 after each
          access to $2007 (see "PPU Memory").
        */
        switch (addr) {
            case 0x2000:
                this.t = (this.v & 0x73ff) | ((value & 3) << 10);
                this.daddrWrite = value & 0x04 ? 32 : 1; //VRAM address increment per CPU read/write of PPUDATA
                this.addrSpritePatternTable = value & 0x08 ? 0x1000 : 0;
                this.addrScreenPatternTable = value & 0x10 ? 0x1000 : 0;
                this.spriteHeight = value & 0x20 ? 16 : 8;
                this.vblankEnable = !!(value & 0x80);
                break;
            case 0x2001:
                this.imageGrayscale = !!(value & 0x01);
                this.showBgInLeftmost8Pixels = !!(value & 0x02);
                this.showSpritesInLeftmost8Pixels = !!(value & 0x04);
                this.showBg = !!(value & 0x08);
                this.showSprites = !!(value & 0x10);
                this.emphasizeRed = !!(value & 0x20);
                this.emphasizeGreen = !!(value & 0x40);
                this.emphasizeBlue = !!(value & 0x80);
                break;
            case 0x2005:
                if (this.w === 0) {
                    this.t = (this.t & 0x73e0) | ((value >> 3) & 0x1f);
                    this.x = value & 7; 
                } else {
                    this.t = (this.t & 0x7c1f) | (((value >> 3) & 0x1f) << 5);
                    this.t = (this.t & 0x0fff) | (value & 7) << 10;
                }
                this.w = 1 - this.w;
                break;
            case 0x2006:
                if (this.w === 0) {
                    this.t = (this.t & 0x00ff) | ((value & 0x3f) << 8);
                } else {
                    this.t = (this.t & 0xff00) + (value & 0xff);
                    this.v = this.t;
                }
                this.w = 1 - this.w;

                break;
            case 0x2007:
                this.vmemory.setByte(this.v & 0x3fff, value);
                this.v += this.daddrWrite;
                this.v &= 0x3fff;
                break;
        }
    }

    private incrementX() {

        this.x++;
        if (this.x === 8) {
            this.x = 0;
            // Coarse X increment
            // The coarse X component of v needs to be incremented when the next tile is reached.
            // Bits 0- 4 are incremented, with overflow toggling bit 10. This means that bits 0- 4 count 
            // from 0 to 31 across a single nametable, and bit 10 selects the current nametable horizontally.

            if ((this.v & 0x001F) === 31) { // if coarse X == 31
                this.v &= ~0x001F; // coarse X = 0
                this.v ^= 0x0400; // switch horizontal nametable
            } else {
                this.v += 1; // increment coarse X
            }
        }
    }

    private incrementY() {
        this.v = (this.v & ~0x001F) | (this.t & 0x1f); // reset coarse X
        this.v ^= 0x0400; // switch horizontal nametable

        // If rendering is enabled, fine Y is incremented at dot 256 of each scanline, overflowing to coarse Y, 
        // and finally adjusted to wrap among the nametables vertically.
        // Bits 12- 14 are fine Y.Bits 5- 9 are coarse Y.Bit 11 selects the vertical nametable.
        if ((this.v & 0x7000) !== 0x7000) // if fine Y < 7
            this.v += 0x1000; // increment fine Y
        else {
            this.v &= ~0x7000; // fine Y = 0

            var y = (this.v & 0x03E0) >> 5; // let y = coarse Y
            if (y === 29) {
                y = 0; // coarse Y = 0
                this.v ^= 0x0800; // switch vertical nametable
            } else if (y === 31) {
                y = 0; // coarse Y = 0, nametable not switched
            } else {
                y += 1; // increment coarse Y
            }
            this.v = (this.v & ~0x03E0) | (y << 5); // put coarse Y back into v
            /* Row 29 is the last row of tiles in a nametable. To wrap to the next nametable when incrementing coarse Y from 29, 
               the vertical nametable is switched by toggling bit 11, and coarse Y wraps to row 0.
               Coarse Y can be set out of bounds (> 29), which will cause the PPU to read the attribute data stored there as tile data. 
               If coarse Y is incremented from 31, it will wrap to 0, but the nametable will not switch. 
               For this reason, a write >= 240 to $2005 may appear as a "negative" scroll value, where 1 or 2 rows of attribute data will 
               appear before the nametable's tile data is reached.
            */
        }
    }

    public render(canvas: HTMLCanvasElement) {
        let ctx = canvas.getContext('2d');
        let imageData = ctx.getImageData(0, 0, 256, 240);
        let buf = new ArrayBuffer(imageData.data.length);
        let buf8 = new Uint8ClampedArray(buf);
        let data = new Uint32Array(buf);
        let dataAddr = 0;
        this.v = this.t;

        for (let sy = 0; sy < 240; sy++) {
            for (let sx = 0; sx < 256; sx++) {
                // The high bits of v are used for fine Y during rendering, and addressing nametable data 
                // only requires 12 bits, with the high 2 CHR addres lines fixed to the 0x2000 region. 
                //
                // The address to be fetched during rendering can be deduced from v in the following way:
                //   tile address      = 0x2000 | (v & 0x0FFF)
                //   attribute address = 0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07)
                //
                // The low 12 bits of the attribute address are composed in the following way:
                //   NN 1111 YYY XXX
                //   || |||| ||| +++-- high 3 bits of coarse X (x / 4)
                //   || |||| +++------ high 3 bits of coarse Y (y / 4)
                //   || ++++---------- attribute offset (960 bytes)
                //   ++--------------- nametable select

                let tileAddr = 0x2000 | (this.v & 0x0fff);
                let attributeAddr = 0x23C0 | (this.v & 0x0C00) | ((this.v >> 4) & 0x38) | ((this.v >> 2) & 0x07);
                let itile = this.vmemory.getByte(tileAddr);
                let ipattern = itile;
                var patternCol = 7 - (this.x);
                var patternRow = this.v >> 12;

                let icolorLow = this.vmemory.getByte(this.addrScreenPatternTable + ipattern * 16 + patternRow);
                let icolorHigh = this.vmemory.getByte(this.addrScreenPatternTable + ipattern * 16 + 8 + patternRow);

                let icolX = (icolorLow & (1 << patternCol)) + (icolorHigh & (1 << patternCol)) << 1;

                if (icolX === 0)
                    data[dataAddr] = 0xff000000;
                else if (icolX === 1)
                    data[dataAddr] = 0xffffffff;
                else if (icolX === 2)
                    data[dataAddr] = 0xffffffff;
                else
                    data[dataAddr] = 0xffffffff;

                dataAddr++;
                this.incrementX();
            }
            this.incrementY();
        }

        (<any>imageData.data).set(buf8);
        ctx.putImageData(imageData, 0, 0);
    }
}