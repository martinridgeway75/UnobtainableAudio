/*global window*/
/*global document*/

window.addEventListener('load', function() {
    (function(){
        "use strict";

    let ua = {};

    function makeKey(rounds, salt, iv) {
        const iterationsHash = btoa((rounds).toString());
        const saltHash = btoa(Array.from(new Uint8Array(salt)).map(val => { return String.fromCharCode(val); }).join(""));
        const ivHash = btoa(Array.from(new Uint8Array(iv)).map(val => { return String.fromCharCode(val); }).join(""));

        ua.rounds = rounds;
        ua.b64key = "" + iterationsHash + "_" + saltHash + "_" + ivHash;
    }

    async function encrypt(audioBin) {
        try {
            const pswrdStr = ua.pswrdStr;
            const rounds = 500000;
            const salt = crypto.getRandomValues(new Uint8Array(32));
            const iv = crypto.getRandomValues(new Uint8Array(12));

            makeKey(rounds, salt, iv);

            const pass = await crypto.subtle.importKey('raw', new TextEncoder().encode(pswrdStr), { "name": "PBKDF2" }, false, ['deriveBits']);
            const devBits = await crypto.subtle.deriveBits({ "name": "PBKDF2", "salt": salt, "iterations": rounds, "hash": { "name": "SHA-256" } }, pass, 256);
            const key = await crypto.subtle.importKey('raw', devBits, { "name": "AES-GCM" }, false, ['encrypt']);
            const enc = await crypto.subtle.encrypt({ "name": "AES-GCM", "iv": iv }, key, audioBin);

            return enc;
        }
        catch(e) {
            console.error(e.name, e.message);
            return;
        }
    }

    function encryptAudio() {
        if (!ua.audioBin) { return; }
        if (!ua.pswrdStr && !ua.pswrdStr.length) { return; }

        const audioBin = ua.audioBin;

        encrypt(audioBin).then((enc) => {
            ua.encData = enc;
            ua.b64keyName = "" + crypto.randomUUID() + ".txt";
            displayInfoForSuccessfulEnc();
        });
        return false;
    }

    function displayInfoForSuccessfulEnc() {
        const infoStr = "{\r\n\taudioFileName : \"" + ua.encDataName + "\",\r\n\tkeyFileName : \"" + ua.b64keyName + "\",\r\n}";

        document.getElementById("keyInfo").textContent = infoStr;
    }

    function downloadEnc() {
        downloadAsFile(ua.encData, ua.encDataName);
    }

    function downloadKey() {
        downloadAsFile(ua.b64key, ua.b64keyName);
    }


    function downloadAsFile(data, dataName) {
        if (!data) { return; }
        if (!dataName && !dataName.length) { return; }

        saveFile(data, dataName).then(() => {

        });
        return false;
    }

    async function saveFile(data, dataName) {
        try {
            const handle = await showSaveFilePicker({ suggestedName: dataName });
            const writable = await handle.createWritable();

            await writable.write(data);
            await writable.close();
            return;
        }
        catch(e) {
            if (e.name !== 'AbortError') {
                console.error(e.name, e.message);
                return;
            }
        }
    }

    function rvExtension(tgtName) {
        return (tgtName.substring(0, tgtName.lastIndexOf('.')) || tgtName);
    }

    function getAudioUploaded(el) {
        const tgt = el.target.files[0];
        const rdr = new FileReader();
                    
        rdr.onloadend = function() {
            ua.audioBin = rdr.result;
            ua.encDataName = "" + rvExtension(tgt.name) + ".bin";
        }
        rdr.readAsArrayBuffer(tgt);
    }

    function readPwInput(evt) {
        ua.pswrdStr = evt.target.value;
    }

    function resetAll() {
        document.getElementById("encForm").reset();
        document.getElementById("keyInfo").textContent = "";
        ua = {};
    }

    function handlersOn() {
        document.getElementById("uploadAud").addEventListener("change",getAudioUploaded,{capture:false,passive:true});
        document.getElementById("passphrase1").addEventListener("input",readPwInput,{capture:false,passive:true});
        document.getElementById("goBtn").addEventListener("click",encryptAudio,{capture:false,passive:true});
        document.getElementById("dlEnc").addEventListener("click",downloadEnc,{capture:false,passive:true});
        document.getElementById("dlKey").addEventListener("click",downloadKey,{capture:false,passive:true});
        document.getElementById("reset").addEventListener("click",resetAll,{capture:false,passive:true});
    }

    function detectFeatures() {
        if (!"crypto" in window) { return; }
        if (!"showSaveFilePicker" in window) { return; }
        if (window.self !== window.top) { return; }
        
        handlersOn();
    }

    detectFeatures();

    })();
    });