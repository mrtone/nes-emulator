﻿///<reference path="CompoundMemory.ts"/>
///<reference path="RAM.ts"/>
///<reference path="NesImage.ts"/>
///<reference path="Mos6502.ts"/>
class NesEmulator {
    public cpu: Mos6502;
    public memory: Mos6502;
    public constructor(nesImage: NesImage) {
        var memory: Memory = null;
        var ip = 0;
        switch (nesImage.mapperType)
        {
            case 0:
                if (nesImage.ROMBanks.length === 1) {
                    memory = new CompoundMemory()
                        .add(new RAM(0xc000))
                        .add(nesImage.ROMBanks[0]);
                    ip = 0xc000;
                }
                else if (nesImage.ROMBanks.length === 2) {
                    memory = new CompoundMemory()
                        .add(new RAM(0x8000))
                        .add(nesImage.ROMBanks[0])
                        .add(nesImage.ROMBanks[1]);
                    ip = memory.getByte(0xfffc) + 256 * memory.getByte(0xfffd);
                }
                break;
            case 1:
                memory = new MMC1(nesImage.ROMBanks);
                ip = memory.getByte(0xfffc) + 256 * memory.getByte(0xfffd);
        }

        if(!memory)
            throw 'unkown mapper ' + nesImage.mapperType;
       
        this.cpu = new Mos6502(memory, ip, 0xfd);
    }
    public step() {
        this.cpu.step();
    }
}