import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./form-validation.js', import.meta.url), 'utf8');
const { fieldError } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const today = new Date('2026-10-11T12:00:00');
const field = (name, value, extra = {}) => ({ name, value, type: 'text', tagName: 'INPUT', validity: {}, ...extra });
const error = (name, value, extra) => fieldError(field(name, value, extra), today);
assert.ok(error('nombres', '', { required: true }));
assert.equal(error('nombres', 'María-José'), '');
assert.ok(error('nombres', 'María123'));
assert.equal(error('whatsapp_publico', '+51 987 654 321'), '');
assert.equal(error('whatsapp_publico', '987654321'), '');
assert.ok(error('whatsapp_publico', '12345'));
assert.equal(error('portafolio_url', 'https://www.instagram.com/Perfil.Prueba'), '');
assert.equal(error('portafolio_url', 'https://mi-sitio.pe/Portafolio?ref=Perfil'), '');
assert.ok(error('portafolio_url', 'http://instagram.com/perfil'));
assert.ok(error('portafolio_url', 'https://usuario@instagram.com/perfil'));
assert.ok(error('ubicacion', 'Miraflores', { dataset: {} }));
assert.equal(error('ubicacion', 'MIRAFLORES — LIMA — LIMA', { dataset: { locationSelected: 'true' } }), '');
assert.ok(error('acepta_privacidad', 'on', { type: 'checkbox', required: true, checked: false }));
assert.equal(error('provincia', '', { required: true, disabled: true }), '');
assert.ok(error('foto_perfil', 'foto.jpg', { type: 'file', validationMessage: 'Archivo demasiado grande.' }));
assert.ok(!fs.readFileSync(new URL('./registro.js', import.meta.url), 'utf8').includes('configureBirthDateLimits'), 'el formulario no aplica restricción de edad');
assert.ok(fs.readFileSync(new URL('./registro.js', import.meta.url), 'utf8').includes('portafolio_url'));
console.log('Formulario: campos, teléfono, portafolio, ubicación e imágenes comprobados; sin filtro de edad.');

// Exercise the real submission handler without sending test records to production.
const registration = fs.readFileSync(new URL('./registro.js', import.meta.url), 'utf8');
const handler = registration.slice(registration.indexOf('form.addEventListener("submit"'), registration.indexOf('\nloadLocations().catch('));
async function submissionTest(failure = false) {
  let submit, confirmation, reset = false, focused = false;
  const button = { disabled: false, textContent: '' };
  const form = { elements: { website: { value: '' }, [Symbol.iterator]: function* () {} }, foto_perfil: { files: [] }, imagen_portada: { files: [] },
    addEventListener: (_, fn) => { submit = fn; }, setAttribute() {}, removeAttribute() {}, reset() { reset = true; }, querySelectorAll: () => [] };
  const context = { form, fieldValidation: {validate:()=>true,reset(){},setError(){}}, clearMessage(){},trimTextFields(){},
    selectedLocation:{departamento:'LIMA',provincia:'LIMA',distrito:'MIRAFLORES'}, locationInput:{dataset:{locationSelected:'true'},focus(){}},
    SITE_CONFIG:{appsScriptEndpoint:'https://example.test'},submitButton:button,cleanFormValues:()=>({nombres:'Prueba',departamento:'LIMA',provincia:'LIMA',distrito:'MIRAFLORES'}),imageFingerprint:()=>'',
    pendingSubmission:null,newSubmissionId:()=> 'test-id',startedAt:0, uploadedImages:new Map(),
    async sendToAppsScript(payload) { if (payload.action === 'validate') return {ok:true}; if (failure) throw new Error('No pudimos confirmar el envío.'); assert.equal(payload.departamento,'LIMA'); assert.equal(payload.provincia,'LIMA'); assert.equal(payload.distrito,'MIRAFLORES'); return {ok:true,id:42}; },
    uploadOptionalImage:async()=>({url:'',failed:false}),showMessage(text){confirmation=text;},message:{focus(){focused=true;},scrollIntoView(){}},
    discardUnusedImages:async()=>{},clearCropState(){},setOptions(){},Date,JSON,Boolean,Promise };
  vm.runInNewContext(handler, context);
  await submit({preventDefault(){}});
  assert.equal(button.disabled, false);
  assert.equal(reset, !failure, confirmation);
  if (failure) { assert.ok(context.pendingSubmission.uncertain); assert.match(confirmation,/confirmar/); }
  else { assert.match(confirmation,/#42.*pendiente de revisión/); assert.equal(focused,true); assert.equal(context.pendingSubmission,null); }
}
await submissionTest();
await submissionTest(true);
console.log('Envío: confirmación con ID, foco, limpieza y conservación de datos ante fallo comprobados con transporte simulado.');
