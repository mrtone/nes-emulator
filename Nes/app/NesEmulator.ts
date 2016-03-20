﻿class NesEmulator {
    cpu: Mos6502;
    memoryMapper: IMemoryMapper;
    ppu: PPU;
    apu: APU;
    controller: Controller;

    public constructor(nesImage: NesImage, canvas:HTMLCanvasElement, driver:IDriver) {
        if (nesImage.fPAL)
            throw 'only NTSC images are supported';
        this.memoryMapper = new MemoryMapperFactory().create(nesImage);

        this.memoryMapper.memory.shadowSetter(0x4014, 0x4014, (_, v) => {
            this.dmaRequested = true;
            this.addrDma = v << 8;
        });

        this.memoryMapper.memory.shadowGetter(0x4016, 0x4016, () => { return this.controller.reg4016; });
        this.memoryMapper.memory.shadowSetter(0x4016, 0x4016, (_, v) => { this.controller.reg4016 = v; });
        this.memoryMapper.memory.shadowGetter(0x4017, 0x4017, () => { return this.controller.reg4016; });

        this.cpu = new Mos6502(this.memoryMapper.memory);
        this.apu = new APU(this.memoryMapper.memory, new IrqLine(this.cpu));
        this.ppu = new PPU(this.memoryMapper.memory, this.memoryMapper.vmemory, this.cpu);
        this.ppu.setDriver(driver);

        this.memoryMapper.setCpuAndPpu(this.cpu, this.ppu);

        this.cpu.reset();
        this.controller = new Controller(canvas);

        window['nesemulator'] = this;
    }

  
    private bDma: number;
    private dmaRequested = false;
    private addrDma: number;
    private idma = 0;
    private icycle = 0;
    step() {

        for (this.icycle = 0; this.icycle < 12; this.icycle++) {

            if ((this.icycle & 3) === 0) {

                const nmiBefore = this.cpu.nmiLine;
                this.ppu.step();
                const nmiAfter = this.cpu.nmiLine;
                if (nmiBefore > nmiAfter && this.icycle === 4)
                    this.cpu.detectInterrupts();
            }

            if (this.icycle === 0) {
                this.memoryMapper.clk();
                    
                if (this.dmaRequested) {

                    if (!(this.cpu.icycle & 1)) {
                        this.dmaRequested = false;
                        this.idma = 512;
                    }
                    this.cpu.icycle++;
                } else if (this.idma > 512) {
                    this.idma--;
                    this.cpu.icycle++;
                } else if (this.idma > 0) {
                    
                    this.cpu.icycle++;
                    if (!(this.idma & 1)) {
                        this.bDma = this.memoryMapper.memory.getByte(this.addrDma++);
                        this.addrDma &= 0xffff;
                    } else {
                        this.memoryMapper.memory.setByte(0x2004, this.bDma);
                    }
                    this.idma--;
                  
                }
                else {
                    this.cpu.step();
                }
            }
            
            this.apu.step();
        }
    }
}
