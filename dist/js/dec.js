/*global window*/
/*global document*/

// window.addEventListener('load', function() {
//     (function(){
        "use strict";

    const pass = document.getElementById("pass1");
    const form = document.getElementById("dec-form");
    const field = document.getElementById("dec-field");
    const uploader = document.getElementById("up-aud");
    const upload_label = document.getElementById("up-aud-label");
    const go_btn = document.getElementById("go-btn");
    //const play_btn = document.getElementById("playBtn");
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
            freezeFormOnError("Decryption error");
        }
    }
    
    function decryptAudio() {
        const encData = au.encData;
        const b64key = au.b64key;
        const pswrdStr = au.pswrdStr;

        decrypt(encData, b64key, pswrdStr).then((aud) => { 
            if (!aud) {
                return false;
            }
            au.audioBin = aud;
            freezeFormDisplayAudio();
        });
        return false;
    }

    function splitBlob(outBlob) {
        const decoder = new TextDecoder();
        const uuid = outBlob.slice(-36);
        
        au.b64keyName = decoder.decode(uuid);
        au.encData = outBlob.slice(0, -36); //the encrypted audio arrayBuffer
        
        fetchKeyWithUuid().then((b64key) => {
            if (!b64key) {
                freezeFormOnError("Key not found");
                return;
            }
            au.b64key = b64key;
        });
    }

    async function fetchKeyWithUuid() {
        const url = "db/" + au.b64keyName + ".txt";

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Key not found"); //e.g. 404
            }
            const b64key = await response.text();
            return b64key;
          } catch(e) {
            freezeFormOnError("Key not found");
        }
    }

    function getBinUploaded(el) {
        let tgt = el.target.files[0];
        let rdr = new FileReader();

        rdr.onloadend = function() {
            splitBlob(rdr.result);
            upload_label.textContent = tgt.name;
        }
        rdr.readAsArrayBuffer(tgt);
    }

    function readPwInput(evt) {
        au.pswrdStr = evt.target.value;
        go_btn.classList.remove("btn-primary");

        if (!au.encData) { return; }
        if (!au.b64key?.length) { return; }
        if (!au.pswrdStr?.length) { return; }

        go_btn.classList.add("btn-primary");
    }
    
    function confirmCanDecrypt() {
        if (!au.encData) { return; }
        if (!au.b64key?.length) { return; }
        if (!au.pswrdStr?.length) { return; }
        if (!go_btn.classList.contains("btn-primary")) { return; }

        decryptAudio();
    }

    // function resetAll() {
    //     upload_label.textContent = "Upload encrypted file";
    //     go_btn.classList.remove("btn-primary");
    //     go_btn.style.borderColor = "";
    //     go_btn.textContent = "Decrypt";
    //     form.reset();
    //     au = {};
    // }

    function freezeForm(msg) {
        go_btn.classList.remove("btn-primary");
        go_btn.style.borderColor = "transparent";
        go_btn.textContent = msg;
        field.disabled = true;
    }
    
    function freezeFormOnError(msg) {
        au = {};
        freezeForm(msg);
    }

    function freezeFormDisplayAudio() {
        delete au.b64key;
        delete au.b64keyName;
        delete au.encData;
        delete au.pswrdStr;

        freezeForm("Successfully decrypted");
        //playAudio(); //not here! should be as click handler
    }
    
    function handlersOn() {
        uploader.addEventListener("change",getBinUploaded,{capture:false,passive:true});
        pass.addEventListener("input",readPwInput,{capture:false,passive:true});
        go_btn.addEventListener("click",confirmCanDecrypt,{capture:false,passive:true});
    }

    function detectFeatures() {
        if (!"crypto" in window) { return; }
        if (!"fetch" in window) { return; }
        if (window.self !== window.top) { return; }
        
        handlersOn();
    }

    detectFeatures();



/**********************************/

//1. build the play, pause, stop audio buttons && timer
//2. attach the click handlers 

function playAudio() {
    buildAudioCtx().then(() => {
        //
    }); 
}

async function buildAudioCtx() {
    if (!au.audioBin) {
        freezeFormOnError("No audio data");
        return;
    }

    const ctx = new window.AudioContext();
    const src = ctx.createBufferSource();
    const audiodata = await ctx.decodeAudioData(au.audioBin);

    src.buffer = (audiodata);
    src.connect(ctx.destination);
    src.start(0); //NOTE: can only be called once
}









    // })();
    // });