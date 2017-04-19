import {NesRunner} from "./runner/NesRunner";


(function(){
    const window:Window = require('window');

    let rom = window.location.hash.substring(1);
    rom = rom ? rom : 'Super Mario Bros';
    new NesRunner(window.document.getElementById('nesContainer'), 'roms/' + rom + '.nes').run();
})();


export default class Lofasz{

}