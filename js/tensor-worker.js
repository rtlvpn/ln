importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js');

// Initialize WebGL in the worker
async function initWebGL() {
  // Set optimization flags
  tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
  tf.env().set('WEBGL_CPU_FORWARD', false);
  tf.env().set('WEBGL_PACK', true);
  
  await tf.ready();
  await tf.setBackend('webgl');
  
  return tf.getBackend() === 'webgl';
}

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, data, id } = e.data;
  
  switch(type) {
    case 'init':
      const gpuAvailable = await initWebGL();
      self.postMessage({ type: 'init', success: gpuAvailable, id });
      break;
      
    case 'processPath':
      try {
        // Process a single path calculation
        const result = await processPathInWorker(data);
        self.postMessage({ type: 'processPath', result, id, success: true });
      } catch (error) {
        self.postMessage({ 
          type: 'processPath', 
          error: error.message,
          id,
          success: false 
        });
      }
      break;
  }
}; 