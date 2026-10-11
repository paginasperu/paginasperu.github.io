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
assert.ok(error('instagram_usuario', '@usuario'));
assert.equal(error('instagram_usuario', 'usuario.peru'), '');
assert.ok(error('correo', 'correo', { type: 'email', validity: { typeMismatch: true } }));
assert.equal(error('fecha_nacimiento', '2008-10-11'), '');
assert.ok(error('fecha_nacimiento', '2008-10-12'));
assert.equal(error('fecha_nacimiento', '1976-10-12'), '');
assert.ok(error('fecha_nacimiento', '1975-10-11'));
assert.ok(error('canva_url', 'https://canva.com.evil.test/a'));
assert.equal(error('canva_url', 'https://www.canva.com/design/abc'), '');
assert.ok(error('acepta_privacidad', 'on', { type: 'checkbox', required: true, checked: false }));
assert.equal(error('provincia', '', { required: true, disabled: true }), '');
assert.ok(error('foto_perfil', 'foto.jpg', { type: 'file', validationMessage: 'Archivo demasiado grande.' }));
console.log('Formulario: campos, teléfono, edad, enlaces e imágenes comprobados.');

// Exercise the real submission handler without sending test records to production.
const registration = fs.readFileSync(new URL('./registro.js', import.meta.url), 'utf8');
const handler = registration.slice(registration.indexOf('form.addEventListener("submit"'), registration.indexOf('\nconfigureBirthDateLimits();'));
async function submissionTest(failure = false) {
  let submit, confirmation, reset = false, focused = false;
  const button = { disabled: false, textContent: '' };
  const form = { elements: { website: { value: '' }, [Symbol.iterator]: function* () {} }, foto_perfil: { files: [] }, imagen_portada: { files: [] },
    addEventListener: (_, fn) => { submit = fn; }, setAttribute() {}, removeAttribute() {}, reset() { reset = true; }, querySelectorAll: () => [] };
  const context = { form, fieldValidation: {validate:()=>true,reset(){},setError(){}}, clearMessage(){},trimTextFields(){},
    locationRows:[{departamento:'LIMA',provincia:'LIMA',distrito:'MIRAFLORES'}], departmentSelect:{value:'LIMA'},provinceSelect:{value:'LIMA'},districtSelect:{value:'MIRAFLORES'},
    SITE_CONFIG:{appsScriptEndpoint:'https://example.test'},submitButton:button,cleanFormValues:()=>({nombres:'Prueba'}),imageFingerprint:()=>'',
    pendingSubmission:null,newSubmissionId:()=> 'test-id',startedAt:0, uploadedImages:new Map(),
    async sendToAppsScript(payload) { if (payload.action === 'validate') return {ok:true}; if (failure) throw new Error('No pudimos confirmar el envío.'); return {ok:true,id:42}; },
    uploadOptionalImage:async()=>({url:'',failed:false}),showMessage(text){confirmation=text;},message:{focus(){focused=true;},scrollIntoView(){}},
    discardUnusedImages:async()=>{},clearCropState(){},setOptions(){},Date,JSON,Boolean,Promise };
  vm.runInNewContext(handler, context);
  await submit({preventDefault(){}});
  assert.equal(button.disabled, false);
  assert.equal(reset, !failure);
  if (failure) { assert.ok(context.pendingSubmission.uncertain); assert.match(confirmation,/confirmar/); }
  else { assert.match(confirmation,/#42.*pendiente de revisión/); assert.equal(focused,true); assert.equal(context.pendingSubmission,null); }
}
await submissionTest();
await submissionTest(true);
console.log('Envío: confirmación con ID, foco, limpieza y conservación de datos ante fallo comprobados con transporte simulado.');
