/*global window*/
/*global document*/

window.addEventListener('load', function() {
    (function(){
        "use strict";

    let au = {};

    function unmakeb64Key(part) {
        return new Uint8Array(atob(part).split("").map(val => { return val.charCodeAt(0); }));
    }

    async function decrypt(encData, b64key, pswrdStr) {
        try {
            const parts = b64key.split("_");
            const rounds = parseInt(atob(parts[0]));
            const salt = unmakeb64Key(parts[1]);
            const iv = unmakeb64Key(parts[2]);

            const pass = await crypto.subtle.importKey('raw', new TextEncoder().encode(pswrdStr), { "name": "PBKDF2" }, false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({ "name": "PBKDF2", "salt": salt, "iterations": rounds, "hash": { "name": "SHA-256" } }, pass, 256);
            const key = await crypto.subtle.importKey('raw', bits, { "name": "AES-GCM" }, false, ['decrypt']);
            const aud = await crypto.subtle.decrypt({ "name": "AES-GCM", "iv": iv }, key, encData);

            return aud;
        }
        catch(e) {
            console.error(e.name, e.message);
            return;
        }
    }

    function decryptAudio() {
        if (!au.encData) { return; }
        if (!au.b64key && !au.b64key.length) { return; }
        if (!au.pswrdStr && !au.pswrdStr.length) { return; }

        const encData = au.encData;
        const b64key = au.b64key;
        const pswrdStr = au.pswrdStr;

        decrypt(encData, b64key, pswrdStr).then((aud) => { 
            au.audioBin = aud;
            document.getElementById("playBtn").className = "";
        });
        return false;
    }

    function getBinUploaded(el) {
        let tgt = el.target.files[0];
        let rdr = new FileReader();
                    
        rdr.onloadend = function() {
            au.encData = rdr.result;
            au.encDataName = "" + tgt.name;
        }
        rdr.readAsArrayBuffer(tgt);
    }

    function getKeyUploaded(el) {
        let tgt = el.target.files[0];
        let rdr = new FileReader();
                    
        rdr.onloadend = function() {
            au.b64key = rdr.result;
            au.b64keyName = "" + tgt.name;
        }
        rdr.readAsText(tgt);
    }

    function playAudio() {
        buildAudioCtx().then(() => {
            
        }); 
    }

    async function buildAudioCtx() {
        if (!au.audioBin) { return; }

        const ctx = new window.AudioContext();
        const src = ctx.createBufferSource();
        const audiodata = await ctx.decodeAudioData(au.audioBin);
    
        src.buffer = (audiodata);
        src.connect(ctx.destination);
        src.start(0); //NOTE: can only be called once
    }

    function readPwInput(evt) {
        au.pswrdStr = evt.target.value;
    }
    
    function handlersOn() {
        document.getElementById("uploadEnc").addEventListener("change",getBinUploaded,{capture:false,passive:true});
        document.getElementById("uploadKey").addEventListener("change",getKeyUploaded,{capture:false,passive:true});
        document.getElementById("passphrase2").addEventListener("input",readPwInput,{capture:false,passive:true});
        document.getElementById("doBtn").addEventListener("click",decryptAudio,{capture:false,passive:true});
        document.getElementById("playbtn").addEventListener("click",playAudio,{capture:false,passive:true});
    }

    function detectFeatures() {
        if (!"crypto" in window) { return; }
        if (window.self !== window.top) { return; }
        
        handlersOn();
    }

    detectFeatures();

    })();
    });