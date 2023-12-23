/*global window*/
/*global document*/

window.addEventListener('load', function() {
    (function(){
        "use strict";

    const pass = document.getElementById("pass1");
    const form = document.getElementById("dec-form");
    const field = document.getElementById("dec-field");
    const go_btn = document.getElementById("go-btn");
    let timer_info;
    let play_btn;
    let ctx;
    let reqAF;
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
            document.getElementById("up-aud-label").textContent = tgt.name;
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

    function formatTimeStamp(ts) {
        let mils = ts * 1000;
    
        return new Date(mils).toISOString().slice(11,22); //must be less than 24 hours to display correctly!
    }
    
    function outputTimestamps() {
        const ts = ctx.getOutputTimestamp();
    
        timer_info.textContent = formatTimeStamp(ts.contextTime);
        reqAF = requestAnimationFrame(outputTimestamps); // re-register itself
    }
    
    function updatePlayBtnEl(rmv, add, pause) {
        play_btn.classList.remove(rmv);
        play_btn.classList.add(add);
        play_btn.dataset.paused = pause;
    }
    
    function updatePlayBtn() {
        let btn_is_paused = play_btn.dataset.paused;
    
        if (btn_is_paused === "false" && ctx.state === "running") {
            ctx.suspend().then(() => {
                updatePlayBtnEl("icon-pause","icon-play","true");
                cancelAnimationFrame(reqAF);
                return;
            });
        }
        if (btn_is_paused === "true" && ctx.state === "suspended") {
            ctx.resume().then(() => {
                updatePlayBtnEl("icon-play","icon-pause","false");
                reqAF = requestAnimationFrame(outputTimestamps);
            });
        }
    }
    
    function audioEnded() {
        cancelAnimationFrame(reqAF);
        updatePlayBtnEl("icon-pause","icon-stop","true");
        ctx.close();
    }
    
    async function initAudio() {
        ctx = new window.AudioContext();
    
        const src = ctx.createBufferSource();
        const audiodata = await ctx.decodeAudioData(au.audioBin);
    
        src.buffer = (audiodata);
        src.connect(ctx.destination);
        src.start(0);
        src.addEventListener("ended",audioEnded,false);
        au = {};
        reqAF = requestAnimationFrame(outputTimestamps);
        play_btn.addEventListener("click",updatePlayBtn,{capture:false,passive:true});
        document.getElementById("audio-nb").textContent = "Audio will play only once through.";
    }

    function oneClickInitAudioPlayback() {
        play_btn.removeEventListener("click",oneClickInitAudioPlayback,{capture:false,passive:true});
        play_btn.classList.remove("icon-play"); //faux init state
        play_btn.classList.add("icon-pause"); //faux init state
        initAudio();
    }
    
    function setAudioPlayerReferences() {
        play_btn = document.getElementById("audio-play");
        timer_info = document.getElementById("audio-time");
        play_btn.addEventListener("click",oneClickInitAudioPlayback,{capture:false,passive:true});
    }
    
    function buildAudioPlayer() {
        const container = document.getElementById("audio-player");
        const frag = document.createDocumentFragment();
        const btn1 = document.createElement("BUTTON");
        const s1 = document.createElement("SPAN");
    
        btn1.id = "audio-play";
        btn1.className = "btn btn-primary me-2 icon-play";
        btn1.dataset.paused = "false"; //faux init state
        s1.id = "audio-time";
    
        frag.appendChild(btn1);
        frag.appendChild(s1);
        container.appendChild(frag);
    
        setAudioPlayerReferences();
    }
    
    function prepareAudio() {
        if (!au.audioBin?.byteLength) {
            freezeFormOnError("No audio data");
            return;
        }
        buildAudioPlayer();
    }

    function freezeFormDisplayAudio() {
        au.b64key = undefined;
        au.b64keyName = undefined;
        au.encData = undefined;
        au.pswrdStr = undefined;

        freezeForm("Successfully decrypted");
        prepareAudio();
    }
    
    function handlersOn() {
        document.getElementById("up-aud").addEventListener("change",getBinUploaded,{capture:false,passive:true});
        pass.addEventListener("input",readPwInput,{capture:false,passive:true});
        go_btn.addEventListener("click",confirmCanDecrypt,{capture:false,passive:true});
    }

    function detectFeatures() {
        if (!"crypto" in window) { return; }
        if (!"fetch" in window) { return; }
        if (!"AudioContext" in window) { return; }
        if (window.self !== window.top) { return; }
        
        handlersOn();
    }

    detectFeatures();

    })();
});