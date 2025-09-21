const go = new Go();
WebAssembly.instantiateStreaming(fetch("/assets/bin/ergnjeroigneurongeu.wasm"), go.importObject).then((result) => {
    go.run(result.instance);
});