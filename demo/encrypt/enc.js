/*global window*/
/*global document*/

window.addEventListener('load', function() {
    (function(){
        "use strict";

    const pass = document.getElementById("pass1");
    const confirm_pass = document.getElementById("pass2");
    const form = document.getElementById("enc-form");
    const field = document.getElementById("enc-field");
    const upload_label = document.getElementById("up-aud-label");
    const go_btn = document.getElementById("go-btn");
    const dl_section = document.getElementById("dl-section");
    let ua = {};

    function makeb64Str(rounds, salt, iv) {
        const iterationsHash = btoa((rounds).toString());
        const saltHash = btoa(Array.from(new Uint8Array(salt)).map(val => { return String.fromCharCode(val); }).join(""));
        const ivHash = btoa(Array.from(new Uint8Array(iv)).map(val => { return String.fromCharCode(val); }).join(""));

        ua.b64key = "" + iterationsHash + "_" + saltHash + "_" + ivHash;
        ua.b64keyName = "" + crypto.randomUUID();
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
      }

    async function encrypt(audioBin) {
        const pswrdStr = ua.pswrdStr;
        const rounds = getRandomInt(500000,900000);
        const salt = crypto.getRandomValues(new Uint8Array(32));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        try {
            const pass = await crypto.subtle.importKey('raw', new TextEncoder().encode(pswrdStr), { "name": "PBKDF2" }, false, ['deriveBits']);
            const devBits = await crypto.subtle.deriveBits({ "name": "PBKDF2", "salt": salt, "iterations": rounds, "hash": { "name": "SHA-256" } }, pass, 256);
            const key = await crypto.subtle.importKey('raw', devBits, { "name": "AES-GCM" }, false, ['encrypt']);
            const encData = await crypto.subtle.encrypt({ "name": "AES-GCM", "iv": iv }, key, audioBin);

            makeb64Str(rounds, salt, iv);
            return encData;
        }
        catch(e) {
            console.error(e.name, e.message);
            return;
        }
    }

    function createDlBlobs(encData) {
        if (!encData) { return; }
        if (!ua.b64key?.length) { return; }
        if (!ua.b64keyName?.length) { return; }

        const encoder = new TextEncoder();
        const uuid = encoder.encode(ua.b64keyName);

        ua.encBlob = new Blob([encData, uuid],{type: "application/octet-stream"});
        ua.keyBlob = new Blob([ua.b64key],{type: "text/plain"});

        freezeFormDisplayInfo();
    }

    function encryptAudio() {
        const audioBin = ua.audioBin;

        encrypt(audioBin).then((encData) => {
            createDlBlobs(encData);
        });
        return false;
    }

    function downloadAsFile(evt) {
        const tgtId = evt.target.id;
        let data;
        let dataName;

        if (tgtId === "bin-dl") {
            data = ua.encBlob;
            dataName = "" + ua.encDataName + ".bin";
        }
        if (tgtId === "key-dl") {
            data = ua.keyBlob;
            dataName = "" + ua.b64keyName + ".txt";
        }
        if (!data) { return; }
        if (!dataName?.length) { return; }

        saveFile(data, dataName);
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

    function rmvExtension(tgtName) {
        return (tgtName.substring(0, tgtName.lastIndexOf('.')) || tgtName);
    }

    function clearPswrd(bool) {
        if (bool === true) {
            pass.value = "";
            confirm_pass.value = "";
        }
        ua.pswrdStr = undefined;
        go_btn.classList.remove("btn-success");
    }

    function getFileUploaded(el) {
        const tgt = el.target.files[0];
        const rdr = new FileReader();

        clearPswrd(true);

        rdr.onloadend = function() {
            ua.audioBin = rdr.result;
            upload_label.textContent = tgt.name;
            ua.encDataName = "" + rmvExtension(tgt.name);
        }
        rdr.readAsArrayBuffer(tgt);
    }

    function clearValidatePwInput() {
        go_btn.classList.remove("btn-success");
        confirm_pass.value = "";
        ua.pswrdStr = undefined;
        return false;
    }

    function validatePwInput(evt) {
        const pw1 = pass.value;
        const pw2 = confirm_pass.value;

        clearPswrd(false);

        if (!pw1.length || !pw2.length) { return false; }
        if (pw1 !== pw2) { return false; }
        if (!ua.audioBin?.byteLength) { return false; }
        
        ua.pswrdStr = evt.target.value;
        go_btn.classList.add("btn-success");
        return false;
    }

    function freezeFormDisplayInfo() {
        go_btn.classList.remove("btn-success");
        go_btn.style.borderColor = "transparent";
        go_btn.textContent = "Encryption successful";
        field.disabled = true;
        dl_section.classList.remove("d-none");
        attachDownloadListeners();
    }

    function resetUa() {
        if (field.disabled == false) { return; }

        releaseDownloadListeners();
        go_btn.style.borderColor = "";
        go_btn.textContent = "Encrypt";
        dl_section.classList.add("d-none");
        upload_label.textContent = "Upload a file";
        field.disabled = false;
        form.reset();
        ua = {};
    }

    function confirmCanEncrypt() {
        if (!ua.audioBin?.byteLength) { return false; }
        if (!ua.pswrdStr?.length) { return false; }
        if (!go_btn.classList.contains("btn-success")) { return false; }

        encryptAudio();
        return false;
    }

    function attachDownloadListeners() {
        document.getElementById("bin-dl").addEventListener("click",downloadAsFile,{capture:false,passive:true});
        document.getElementById("key-dl").addEventListener("click",downloadAsFile,{capture:false,passive:true});
    }

    function releaseDownloadListeners() {
        document.getElementById("bin-dl").removeEventListener("click",downloadAsFile,{capture:false,passive:true});
        document.getElementById("key-dl").removeEventListener("click",downloadAsFile,{capture:false,passive:true});
    }

    function handlersOn() {
        document.getElementById("up-aud").addEventListener("change",getFileUploaded,{capture:false,passive:true});
        pass.addEventListener("input",clearValidatePwInput,{capture:false,passive:true});
        confirm_pass.addEventListener("input",validatePwInput,{capture:false,passive:true});
        go_btn.addEventListener("click",confirmCanEncrypt,{capture:false,passive:true});
        document.getElementById("reset-btn").addEventListener("click",resetUa,{capture:false,passive:true});
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