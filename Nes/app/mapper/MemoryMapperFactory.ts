﻿class MemoryMapperFactory {

    create(nesImage: NesImage):IMemoryMapper {
        switch (nesImage.mapperType) {
            case 0:
                return new Mmc0(nesImage);
            case 1:
                return new Mmc1(nesImage);
            case 2:
                return new UxRom(nesImage);
            case 3:
                return new CNROM(nesImage);
            case 4:
                return new Mmc3(nesImage);
            case 7:
                return new AxRom(nesImage);
            default:
                throw 'unkown mapper ' + nesImage.mapperType;
        }
    }
}
