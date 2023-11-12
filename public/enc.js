/*global window*/
/*global document*/

window.addEventListener('load', function() {
    (function(){
        "use strict";

    let ua = {};

    async function encrypt(audioBin) {
        try {
            const pswrdStr = ua.pswrdStr;
            const rounds = 500000;
            const salt = crypto.getRandomValues(new Uint8Array(32));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const pass = await crypto.subtle.importKey('raw', new TextEncoder().encode(pswrdStr), { "name": "PBKDF2" }, false, ['deriveBits']);
            const iterationsHash = btoa((rounds).toString());
            const saltHash = btoa(Array.from(new Uint8Array(salt)).map(val => { return String.fromCharCode(val); }).join(""));
            const ivHash = btoa(Array.from(new Uint8Array(iv)).map(val => { return String.fromCharCode(val); }).join(""));

            ua.rounds = rounds;
            ua.b64key = "" + iterationsHash + "_" + saltHash + "_" + ivHash;

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
            ua.b64keyName = crypto.randomUUID();
            displayInfoForSuccessfulEnc();
        });
        return false;
    }

    function displayInfoForSuccessfulEnc() {
        const infoStr = "{\r\n\taudio : \"" + ua.encDataName + "\",\r\n\tkey : \"" + ua.b64keyName + "\",\r\n}";

        document.getElementById("keyInfo").textContent = infoStr;
    }

    function downloadEnc() {
        if (!ua.encData) { return; }
        if (!ua.encDataName && !ua.encDataName.length) { return; }

        const encData = ua.encData;
        const encDataName = ua.encDataName;

        saveEncFile(encData, encDataName).then(() => {

        });
        return false;
    }

    async function saveEncFile(encData, encDataName) {
        try {
            const handle = await showSaveFilePicker({ suggestedName: encDataName });
            const writable = await handle.createWritable();

            await writable.write(encData);
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

    function downloadKey() {
        if (!ua.b64key) { return; }
        if (!ua.b64keyName && !ua.b64keyName.length) { return; }

        const b64key = ua.b64key;
        const b64keyName = ua.b64keyName;

        saveEncFile(b64key, b64keyName).then(() => {

        });
        return false;
    }

    async function saveKeyFile(b64key, b64keyName) {
        try {
            const handle = await showSaveFilePicker({ suggestedName: b64keyName });
            const writable = await handle.createWritable();

            await writable.write(b64key);
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

    function getAudioUploaded(el) {
        const tgt = el.target.files[0];
        const rdr = new FileReader();
                    
        rdr.onloadend = function() {
            ua.audioBin = rdr.result;
            ua.encDataName = "" + tgt.name.substring(0, (tgt.name).lastIndexOf(".")) + "_enc"; //TODO: don't use substring -> omission of "." means length == 0!
        }
        rdr.readAsArrayBuffer(tgt);
    }

    function readPwInput(evt) {
        ua.pswrdStr = evt.target.value;
    }

    function resetAll() {
        document.getElementById("passphrase1").value = "";
        document.getElementById("uploadAud").value = "";
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