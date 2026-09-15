const loginView = document.getElementById('loginView');
const loginForm = document.getElementById('loginForm');
const loginUser = document.getElementById('loginUser');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const logoutButton = document.getElementById('logoutBtn');
const createUserForm = document.getElementById('createUserForm');
const newUserEmail = document.getElementById('newUserEmail');
const newUserPassword = document.getElementById('newUserPassword');
const newUserRole = document.getElementById('newUserRole');
const usersList = document.getElementById('usersList');
const userManagementMessage = document.getElementById('userManagementMessage');
const roleForm = document.getElementById('roleForm');
const editingRoleId = document.getElementById('editingRoleId');
const roleNameInput = document.getElementById('roleName');
const roleDescriptionInput = document.getElementById('roleDescription');
const rolesList = document.getElementById('rolesList');
const cancelRoleEditButton = document.getElementById('cancelRoleEditBtn');

let currentUser = null;
let permissions = {};

const consentForm = document.getElementById('consentForm');
const savedDocumentsContainer = document.getElementById('savedDocuments');
const documentsCount = document.getElementById('documentsCount');
const signatureCanvas = document.getElementById('signatureCanvas');
const clearSignatureButton = document.getElementById('clearSignature');
const clearFieldsButton = document.getElementById('clearFieldsBtn');
const savePdfButton = document.getElementById('savePdfBtn');
const downloadButton = document.getElementById('downloadBtn');
const editTitleInput = document.getElementById('editTitle');
const editResponsableInput = document.getElementById('editResponsable');
const editMunicipioInput = document.getElementById('editMunicipio');
const editInstitucionInput = document.getElementById('editInstitucion');
const editObjetivoInput = document.getElementById('editObjetivo');
const editVisitaInput = document.getElementById('editVisita');
const editImportanciaInput = document.getElementById('editImportancia');
const editConfidencialidadInput = document.getElementById('editConfidencialidad');
const editAceptacionInput = document.getElementById('editAceptacion');
const formTitle = document.getElementById('formTitle');
const applyTemplateBtn = document.getElementById('applyTemplateBtn');
const saveTemplateButton = document.getElementById('saveTemplateBtn');
const updateTemplateButton = document.getElementById('updateTemplateBtn');
const templateNameInput = document.getElementById('templateName');
const templateSelect = document.getElementById('templateSelect');
const editTemplateSelect = document.getElementById('editTemplateSelect');
const deleteTemplateButton = document.getElementById('deleteTemplateBtn');
const pdfPrimaryColorInput = document.getElementById('pdfPrimaryColor');
const pdfAccentColorInput = document.getElementById('pdfAccentColor');
const pdfTitleColorInput = document.getElementById('pdfTitleColor');
const pdfFontSizeInput = document.getElementById('pdfFontSize');
const pdfLogoWidthInput = document.getElementById('pdfLogoWidth');
const pdfFooterTextInput = document.getElementById('pdfFooterText');
const saveDesignButton = document.getElementById('saveDesignBtn');
const logoInput = document.getElementById('logoInput');
const logoPreview = document.getElementById('logoPreview');
const fillLogoPreview = document.getElementById('fillLogoPreview');
const acceptanceMessage = document.getElementById('acceptanceMessage');
const menuTabs = document.querySelectorAll('.menu-tab');
const viewPanels = {
  edit: document.getElementById('editView'),
  fill: document.getElementById('fillView'),
  consult: document.getElementById('consultView'),
  users: document.getElementById('usersView')
};

const STORAGE_KEY = 'signedConsentForms';
const LOGO_KEY = 'consentInstitutionLogo';
const LOGO_SETTING_KEY = 'institution_logo';
const TEMPLATE_KEY = 'consentFormTemplate';
const TEMPLATES_KEY = 'consentFormTemplates';
const DESIGN_KEY = 'consentPdfDesign';
let editingTemplateId = '';

const defaultPdfDesign = {
  primaryColor: '#007e53',
  accentColor: '#f6ca1b',
  titleColor: '#000000',
  fontSize: 5.8,
  logoWidth: 42,
  footerText: 'PBX: (+57) 604 569 90 90  WhatsApp: 322 569 90 90'
};
const signaturePad = new SignaturePad(signatureCanvas, {
  minWidth: 1.2,
  maxWidth: 2.2,
  penColor: '#101827',
  backgroundColor: '#ffffff'
});

function resizeSignatureCanvas() {
  const width = signatureCanvas.getBoundingClientRect().width;
  const height = signatureCanvas.getBoundingClientRect().height;
  if (!width || !height) return;

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (signatureCanvas.width === pixelWidth && signatureCanvas.height === pixelHeight) return;

  const signatureData = signaturePad.isEmpty() ? null : signaturePad.toData();
  signatureCanvas.width = pixelWidth;
  signatureCanvas.height = pixelHeight;
  signatureCanvas.getContext('2d').scale(ratio, ratio);
  signaturePad.clear();
  if (signatureData) signaturePad.fromData(signatureData);
}

function setAuthenticated(isAuthenticated) {
  loginView.classList.toggle('hidden-view', isAuthenticated);
  document.querySelector('.app-shell').classList.toggle('hidden-view', !isAuthenticated);
  document.querySelector('.footer-info').classList.toggle('hidden-view', !isAuthenticated);
}

async function handleLogin(event) {
  event.preventDefault();
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: loginUser.value.trim().toLowerCase(),
    password: loginPassword.value
  });
  if (error || !data.session) {
    loginError.textContent = 'Correo o clave incorrectos.';
    loginPassword.select();
    return;
  }

  loginError.textContent = '';
  loginForm.reset();
  await initializeAccess(data.session);
}

async function logout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  permissions = {};
  setAuthenticated(false);
  loginUser.focus();
}

function hasPermission(permissionKey, requiresEdit = false) {
  return Boolean(permissions[permissionKey] && (!requiresEdit || permissions[permissionKey].canEdit));
}

function requirePermission(permissionKey, requiresEdit = false) {
  if (hasPermission(permissionKey, requiresEdit)) return true;
  alert('No tiene permiso para realizar esta acción.');
  return false;
}

async function initializeAccess(session) {
  currentUser = session?.user || null;
  if (!currentUser) {
    setAuthenticated(false);
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('app_profiles')
    .select('role_id, email')
    .eq('id', currentUser.id)
    .maybeSingle();
  if (profileError || !profile?.role_id) {
    loginError.textContent = 'Su usuario todavía no tiene un rol asignado.';
    await supabaseClient.auth.signOut();
    setAuthenticated(false);
    return;
  }

  const { data: rolePermissions, error: permissionError } = await supabaseClient
    .from('app_role_permissions')
    .select('permission_key, can_edit')
    .eq('role_id', profile.role_id);
  if (permissionError) {
    loginError.textContent = 'No se pudieron cargar los permisos del usuario.';
    await supabaseClient.auth.signOut();
    setAuthenticated(false);
    return;
  }

  permissions = Object.fromEntries((rolePermissions || []).map((item) => [item.permission_key, { canEdit: item.can_edit }]));
  applyPermissions();
  setAuthenticated(true);
  const firstAllowedView = Object.keys(viewPanels).find((key) => hasPermission(key));
  if (firstAllowedView) switchView(firstAllowedView);
  await loadRolesAndUsers();
}

function applyPermissions() {
  document.querySelectorAll('[data-permission]').forEach((element) => {
    const allowed = hasPermission(element.dataset.permission, element.hasAttribute('data-requires-edit'));
    element.classList.toggle('hidden-view', !allowed);
    if ('disabled' in element) element.disabled = !allowed;
  });
}

function getFormValues() {
  const formData = new FormData(consentForm);
  return Object.fromEntries(formData.entries());
}

function getPdfDesign() {
  try {
    return { ...defaultPdfDesign, ...JSON.parse(localStorage.getItem(DESIGN_KEY) || '{}') };
  } catch (error) {
    return { ...defaultPdfDesign };
  }
}

function loadPdfDesign() {
  const design = getPdfDesign();
  pdfPrimaryColorInput.value = design.primaryColor;
  pdfAccentColorInput.value = design.accentColor;
  pdfTitleColorInput.value = design.titleColor;
  pdfFontSizeInput.value = design.fontSize;
  pdfLogoWidthInput.value = design.logoWidth;
  pdfFooterTextInput.value = design.footerText;
}

async function savePdfDesign() {
  if (!requirePermission('edit', true)) return;
  const design = {
    primaryColor: pdfPrimaryColorInput.value,
    accentColor: pdfAccentColorInput.value,
    titleColor: pdfTitleColorInput.value,
    fontSize: Math.min(8, Math.max(5, Number(pdfFontSizeInput.value) || defaultPdfDesign.fontSize)),
    logoWidth: Math.min(60, Math.max(25, Number(pdfLogoWidthInput.value) || defaultPdfDesign.logoWidth)),
    footerText: pdfFooterTextInput.value.trim() || defaultPdfDesign.footerText
  };
  localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
  loadPdfDesign();
  if (editingTemplateId) {
    const logo = localStorage.getItem(LOGO_KEY) || '';
    try {
      const { error } = await supabaseClient
        .from('form_templates')
        .update({ design: { ...design, logo }, updated_at: new Date().toISOString() })
        .eq('id', editingTemplateId);
      if (error) throw error;
    } catch (error) {
      const localTemplates = getSavedTemplates().map((template) => template.id === editingTemplateId
        ? { ...template, design: { ...design, logo }, logo }
        : template);
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(localTemplates));
    }
    const storedTemplate = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || 'null');
    if (storedTemplate?.id === editingTemplateId) {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ ...storedTemplate, design: { ...design, logo }, logo }));
    }
  }
  alert('El diseño del PDF se guardó correctamente.');
}

function applySavedDesign(design) {
  if (!design || typeof design !== 'object') return;
  localStorage.setItem(DESIGN_KEY, JSON.stringify({ ...defaultPdfDesign, ...design }));
  loadPdfDesign();
}

function applySavedLogo(dataUrl) {
  if (!dataUrl) return;
  localStorage.setItem(LOGO_KEY, dataUrl);
  updateLogoPreview(dataUrl);
}

function getTemplateValues() {
  return {
    title: editTitleInput.value,
    responsable: editResponsableInput.value,
    municipio: editMunicipioInput.value,
    institucion: editInstitucionInput.value,
    objetivo: editObjetivoInput.value,
    visita: editVisitaInput.value,
    importancia: editImportanciaInput.value,
    confidencialidad: editConfidencialidadInput.value,
    aceptacion: editAceptacionInput.value
  };
}

function setTemplateValue(selector, value) {
  const field = document.querySelector(selector);
  if (field && value !== undefined) field.value = value;
}

function applyTemplateToForm(template) {
  formTitle.textContent = (template.title || 'CONSENTIMIENTO INFORMADO').toUpperCase();
  setTemplateValue('input[name="responsablesMunicipio"]', template.responsable);
  setTemplateValue('input[name="municipio"]', template.municipio);
  setTemplateValue('input[name="institucion"]', template.institucion);
  setTemplateValue('textarea[name="objetivo"]', template.objetivo);
  setTemplateValue('textarea[name="visitaFamiliar"]', template.visita);
  setTemplateValue('textarea[name="importancia"]', template.importancia);
  setTemplateValue('textarea[name="confidencialidad"]', template.confidencialidad);
  acceptanceMessage.textContent = template.aceptacion || 'Aceptación no especificada';
}

function saveTemplate() {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(getTemplateValues()));
}

function getSavedTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

async function getCloudTemplates() {
  const { data, error } = await supabaseClient
    .from('form_templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    ...(row.content || {}),
    design: row.design || {}
  }));
}

async function getAvailableTemplates() {
  try {
    const cloudTemplates = await getCloudTemplates();
    const localTemplates = getSavedTemplates();
    const cloudIds = new Set(cloudTemplates.map((template) => template.id));
    return [...cloudTemplates, ...localTemplates.filter((template) => !cloudIds.has(template.id))];
  } catch (error) {
    return getSavedTemplates();
  }
}

async function renderTemplateOptions() {
  templateSelect.innerHTML = '<option value="">Usar formulario actual</option>';
  editTemplateSelect.innerHTML = '<option value="">Seleccionar formulario guardado</option>';
  const savedTemplates = await getAvailableTemplates();
  savedTemplates.forEach((template) => {
    const option = document.createElement('option');
    option.value = template.id;
    option.textContent = template.name;
    templateSelect.appendChild(option);
    editTemplateSelect.appendChild(option.cloneNode(true));
  });
}

async function saveNamedTemplate() {
  if (!requirePermission('edit', true)) return;
  const name = templateNameInput.value.trim() || editTitleInput.value.trim() || 'Formulario sin nombre';
  const template = {
    id: `template-${Date.now()}`,
    name,
    ...getTemplateValues(),
    design: getPdfDesign(),
    logo: localStorage.getItem(LOGO_KEY) || ''
  };
  try {
    const { data, error } = await supabaseClient
      .from('form_templates')
      .insert({ name, content: getTemplateValues(), design: { ...getPdfDesign(), logo: template.logo } })
      .select()
      .single();
    if (error) throw error;
    template.id = data.id;
  } catch (error) {
    const savedTemplates = getSavedTemplates();
    savedTemplates.unshift(template);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(savedTemplates));
  }
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
  await renderTemplateOptions();
  templateSelect.value = template.id;
  editTemplateSelect.value = template.id;
  editingTemplateId = template.id;
  templateNameInput.value = '';
  alert(`El formulario "${name}" se guardó correctamente.`);
}

async function updateSelectedTemplate() {
  if (!requirePermission('edit', true)) return;
  if (!editingTemplateId) {
    alert('Seleccione primero un formulario guardado para editarlo.');
    return;
  }

  const savedTemplates = await getAvailableTemplates();
  const current = savedTemplates.find((item) => item.id === editingTemplateId);
  if (!current) return;
  const updatedTemplate = {
    ...current,
    name: templateNameInput.value.trim() || current.name,
    ...getTemplateValues(),
    design: getPdfDesign(),
    logo: localStorage.getItem(LOGO_KEY) || current.logo || ''
  };
  try {
    const { error } = await supabaseClient
      .from('form_templates')
      .update({ name: updatedTemplate.name, content: getTemplateValues(), design: { ...getPdfDesign(), logo: updatedTemplate.logo }, updated_at: new Date().toISOString() })
      .eq('id', editingTemplateId);
    if (error) throw error;
  } catch (error) {
    const localTemplates = getSavedTemplates().filter((item) => item.id !== editingTemplateId);
    localTemplates.push(updatedTemplate);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(localTemplates));
  }
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(updatedTemplate));
  await renderTemplateOptions();
  templateSelect.value = editingTemplateId;
  editTemplateSelect.value = editingTemplateId;
  alert(`El formulario "${updatedTemplate.name}" se actualizó correctamente.`);
}

async function deleteSelectedTemplate() {
  if (!requirePermission('edit', true)) return;
  if (!editingTemplateId) {
    alert('Seleccione primero un formulario guardado para eliminarlo.');
    return;
  }

  const savedTemplates = await getAvailableTemplates();
  const selectedTemplate = savedTemplates.find((item) => item.id === editingTemplateId);
  if (!selectedTemplate) return;
  if (!window.confirm(`¿Desea eliminar el formulario "${selectedTemplate.name}"?`)) return;

  try {
    const { error } = await supabaseClient.from('form_templates').delete().eq('id', editingTemplateId);
    if (error) throw error;
  } catch (error) {
    const remainingTemplates = getSavedTemplates().filter((item) => item.id !== editingTemplateId);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(remainingTemplates));
  }
  try {
    const currentTemplate = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || 'null');
    if (currentTemplate?.id === editingTemplateId) localStorage.removeItem(TEMPLATE_KEY);
  } catch (error) {
    localStorage.removeItem(TEMPLATE_KEY);
  }
  if (templateSelect.value === editingTemplateId) templateSelect.value = '';
  editingTemplateId = '';
  editTemplateSelect.value = '';
  templateNameInput.value = '';
  await renderTemplateOptions();
  templateSelect.value = '';
  editTemplateSelect.value = '';
  alert('El formulario guardado fue eliminado.');
  window.location.reload();
}

async function loadNamedTemplate(templateId) {
  if (!templateId) return;
  const template = (await getAvailableTemplates()).find((item) => item.id === templateId);
  if (!template) return;

  editTitleInput.value = template.title || '';
  editResponsableInput.value = template.responsable || '';
  editMunicipioInput.value = template.municipio || '';
  editInstitucionInput.value = template.institucion || '';
  editObjetivoInput.value = template.objetivo || '';
  editVisitaInput.value = template.visita || '';
  editImportanciaInput.value = template.importancia || '';
  editConfidencialidadInput.value = template.confidencialidad || '';
  editAceptacionInput.value = template.aceptacion || '';
  templateNameInput.value = template.name || '';
  editingTemplateId = template.id;
  applySavedDesign(template.design);
  applySavedLogo(template.logo || template.design?.logo);
  applyTemplateToForm(template);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
}

async function loadStoredTemplate() {
  const storedTemplate = localStorage.getItem(TEMPLATE_KEY);
  if (!storedTemplate) return;

  try {
    const template = JSON.parse(storedTemplate);
    const availableTemplates = await getAvailableTemplates();
    const centralTemplate = availableTemplates.find((item) => item.id === template.id);
    const templateToApply = centralTemplate || template;
    editTitleInput.value = templateToApply.title ?? editTitleInput.value;
    editResponsableInput.value = templateToApply.responsable ?? editResponsableInput.value;
    editMunicipioInput.value = templateToApply.municipio ?? editMunicipioInput.value;
    editInstitucionInput.value = templateToApply.institucion ?? editInstitucionInput.value;
    editObjetivoInput.value = templateToApply.objetivo ?? editObjetivoInput.value;
    editVisitaInput.value = templateToApply.visita ?? editVisitaInput.value;
    editImportanciaInput.value = templateToApply.importancia ?? editImportanciaInput.value;
    editConfidencialidadInput.value = templateToApply.confidencialidad ?? editConfidencialidadInput.value;
    editAceptacionInput.value = templateToApply.aceptacion ?? editAceptacionInput.value;
    templateNameInput.value = templateToApply.name || '';
    editingTemplateId = templateToApply.id || '';
    applySavedDesign(templateToApply.design);
    applySavedLogo(templateToApply.logo || templateToApply.design?.logo);
    applyTemplateToForm(templateToApply);
  } catch (error) {
    localStorage.removeItem(TEMPLATE_KEY);
  }
}

function formatDate(value) {
  if (!value) return 'No especificada';
  const date = new Date(value + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function wrapText(doc, text, x, y, maxWidth, lineHeight) {
  const safeText = text ?? 'No especificado';
  const lines = doc.splitTextToSize(safeText, maxWidth);
  doc.text(lines, x, y);
  return lines.length * lineHeight;
}

function addSectionHeader(doc, title, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 14, y);
  doc.setFont('helvetica', 'normal');
  return y + 8;
}

function imageFormatFromDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/([^;]+)/i);
  if (!match) return 'PNG';
  return match[1].toUpperCase() === 'JPG' ? 'JPEG' : match[1].toUpperCase();
}

function drawPdfCell(pdf, text, x, y, width, height, options = {}) {
  const { bold = false, fontSize = 6.1, align = 'left', padding = 1.8 } = options;
  pdf.rect(x, y, width, height);
  pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(0, 0, 0);

  const lines = pdf.splitTextToSize(String(text || ''), Math.max(width - padding * 2, 2));
  const lineHeight = fontSize * 0.35;
  const visibleLines = lines.slice(0, Math.max(1, Math.floor((height - padding * 2) / lineHeight)));
  const textHeight = visibleLines.length * lineHeight;
  const startY = y + Math.max(padding + fontSize * 0.28, (height - textHeight) / 2);

  visibleLines.forEach((line, index) => {
    let textX = x + padding;
    if (align === 'center') textX = x + width / 2;
    if (align === 'right') textX = x + width - padding;
    pdf.text(line, textX, startY + index * lineHeight, { align });
  });
}

function buildPdfDocument() {
  const data = getFormValues();
  const patientName = data.nombrePaciente || 'Paciente';
  const finalName = `${patientName}-${new Date().toISOString().slice(0, 10)}`;
  const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const logoData = localStorage.getItem(LOGO_KEY);
  const design = getPdfDesign();

  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const tableX = 30;
  const tableWidth = 168;
  const halfWidth = tableWidth / 2;

  pdf.setFillColor(design.primaryColor);
  pdf.triangle(0, 0, 24, 0, 16, 8, 'F');
  pdf.setFillColor(design.accentColor);
  pdf.triangle(34, 0, 92, 0, 82, 8, 'F');

  if (logoData) {
    try {
      pdf.addImage(logoData, imageFormatFromDataUrl(logoData), 189 - design.logoWidth, 8, design.logoWidth, 17, undefined, 'FAST');
    } catch (error) {
      console.warn('No se pudo cargar el logo en el PDF', error);
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(design.titleColor);
  pdf.text((document.getElementById('formTitle')?.textContent || 'CONSENTIMIENTO INFORMADO').toUpperCase(), pageWidth / 2, 29, { align: 'center' });

  let y = 34;
  const rowHeight = 8;
  drawPdfCell(pdf, `Responsables de la Estrategia en el Municipio: ${data.responsablesMunicipio || ''}`, tableX, y, halfWidth, rowHeight, { bold: true });
  drawPdfCell(pdf, `Municipio: ${data.municipio || ''}`, tableX + halfWidth, y, halfWidth, rowHeight, { bold: true });
  y += rowHeight;

  drawPdfCell(pdf, `ESE o institución: ${data.institucion || ''}`, tableX, y, halfWidth, rowHeight, { bold: true });
  drawPdfCell(pdf, '', tableX + halfWidth, y, halfWidth, rowHeight);
  y += rowHeight + 1;

  drawPdfCell(pdf, 'INFORMACIÓN DE LA PERSONA:', tableX, y, tableWidth, 6, { bold: true });
  y += 6;
  drawPdfCell(pdf, `Nombre completo: ${data.nombreCompletoPersona || ''}`, tableX, y, tableWidth * 0.62, rowHeight);
  drawPdfCell(pdf, `Documento identidad: ${data.documentoPersona || data.documento || ''}`, tableX + tableWidth * 0.62, y, tableWidth * 0.38, rowHeight);
  y += rowHeight;

  const sections = [
    ['OBJETIVO:', data.objetivo || ''],
    ['VISITA FAMILIAR', data.visitaFamiliar || ''],
    ['IMPORTANCIA', data.importancia || ''],
    ['CONFIDENCIALIDAD', data.confidencialidad || '']
  ];

  sections.forEach(([heading, text]) => {
    drawPdfCell(pdf, heading, tableX, y, tableWidth, 5, { bold: true });
    y += 5;
    const lines = pdf.splitTextToSize(text, tableWidth - 5);
    const height = Math.max(10, Math.min(27, lines.length * 3.1 + 3));
    drawPdfCell(pdf, text, tableX, y, tableWidth, height, { fontSize: design.fontSize });
    y += height;
  });

  drawPdfCell(pdf, 'ACEPTACIÓN', tableX, y, tableWidth, 5, { bold: true });
  y += 5;
  const consentText = data.acepto === 'on' ? acceptanceMessage.textContent : 'No se ha confirmado el consentimiento.';
  const consentLines = pdf.splitTextToSize(consentText, tableWidth - 5);
  const consentHeight = Math.max(11, Math.min(22, consentLines.length * 3.1 + 3));
  drawPdfCell(pdf, consentText, tableX, y, tableWidth, consentHeight, { fontSize: design.fontSize });
  y += consentHeight;

  drawPdfCell(pdf, 'Responsable\ny Familiar:', tableX, y, 24, 31, { bold: true });
  drawPdfCell(pdf, 'NOMBRE COMPLETO', tableX + 24, y, 51, 6, { bold: true });
  drawPdfCell(pdf, 'LUGAR', tableX + 75, y, 51, 6, { bold: true });
  drawPdfCell(pdf, 'FIRMA', tableX + 126, y, 42, 6, { bold: true });
  drawPdfCell(pdf, data.nombreFirmante || data.nombrePaciente || '', tableX + 24, y + 6, 51, 25);
  drawPdfCell(pdf, `${data.lugarFirma || ''}\n${formatDate(data.fechaFirma)}`, tableX + 75, y + 6, 51, 25);
  drawPdfCell(pdf, '', tableX + 126, y + 6, 42, 25);

  const signatureData = signaturePad.isEmpty() ? null : signaturePad.toDataURL('image/png');
  if (signatureData) {
    try {
      pdf.addImage(signatureData, 'PNG', tableX + 128, y + 10, 36, 17, undefined, 'FAST');
    } catch (error) {
      console.warn('No se pudo cargar la firma en el PDF', error);
    }
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.3);
  pdf.setTextColor(0, 0, 0);
  const footerY = pageHeight - 17;
  pdf.text(design.footerText, 16, footerY);
  pdf.text('Sector 3, Cra. 46 No. 40B - 50  NIT: 890984746 - 7', 16, footerY + 4);
  pdf.text('Rionegro - Antioquia - Colombia', 16, footerY + 8);
  pdf.text('www.uco.edu.co   @uconiano   Universidad Católica de Oriente', 16, footerY + 13);

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  return {
    pdf,
    fileName: `${finalName}.pdf`
  };
}

function buildPdfAndDataUrl() {
  const { pdf, fileName } = buildPdfDocument();
  const pdfBlob = pdf.output('blob');
  const reader = new FileReader();

  return new Promise((resolve) => {
    reader.onloadend = () => {
      resolve({
        pdfBlob,
        pdfDataUrl: reader.result,
        fileName
      });
    };
    reader.readAsDataURL(pdfBlob);
  });
}

function saveLogoToStorage(dataUrl) {
  localStorage.setItem(LOGO_KEY, dataUrl);
  updateLogoPreview(dataUrl);

  return supabaseClient
    .from('app_settings')
    .upsert({ key: LOGO_SETTING_KEY, value: dataUrl }, { onConflict: 'key' })
    .then(({ error }) => {
      if (error) throw error;
    })
    .catch((error) => {
      console.warn('No se pudo sincronizar el logo entre dispositivos', error);
    });
}

function updateLogoPreview(dataUrl) {
  if (!dataUrl) {
    logoPreview.src = '';
    fillLogoPreview.src = '';
    return;
  }

  logoPreview.src = dataUrl;
  fillLogoPreview.src = dataUrl;
}

async function loadStoredLogo() {
  const storedLogo = localStorage.getItem(LOGO_KEY);
  if (storedLogo) {
    updateLogoPreview(storedLogo);
  }

  try {
    const { data, error } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', LOGO_SETTING_KEY)
      .maybeSingle();
    if (error) throw error;

    if (data?.value) {
      localStorage.setItem(LOGO_KEY, data.value);
      updateLogoPreview(data.value);
    } else if (storedLogo) {
      await saveLogoToStorage(storedLogo);
    }
  } catch (error) {
    console.warn('No se pudo cargar el logo compartido', error);
  }
}

async function savePdfToStorage(pdfDataUrl, fileName) {
  const savedForms = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `form-${Date.now()}`,
    fileName,
    createdAt: new Date().toISOString(),
    pdf: pdfDataUrl
  };

  try {
    const { error } = await supabaseClient
      .from('signed_forms')
      .insert({ file_name: fileName, pdf_data: pdfDataUrl });
    if (error) throw error;
  } catch (error) {
    savedForms.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedForms));
  }
  await renderSavedDocuments();
}

async function getCloudSignedForms() {
  const { data, error } = await supabaseClient
    .from('signed_forms')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    createdAt: row.created_at,
    pdf: row.pdf_data
  }));
}

async function getAvailableSignedForms() {
  try {
    const cloudForms = await getCloudSignedForms();
    const localForms = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const cloudIds = new Set(cloudForms.map((form) => form.id));
    return [...cloudForms, ...localForms.filter((form) => !cloudIds.has(form.id))];
  } catch (error) {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }
}

async function renderSavedDocuments() {
  const savedForms = await getAvailableSignedForms();
  const totalNodes = document.querySelectorAll('#documentsCount');
  totalNodes.forEach((node) => {
    node.textContent = String(savedForms.length);
  });

  if (!savedForms.length) {
    savedDocumentsContainer.innerHTML = '<div class="empty-state">Todavía no hay formularios firmados guardados.</div>';
    return;
  }

  savedDocumentsContainer.innerHTML = savedForms
    .map((record) => {
      const createdAt = new Date(record.createdAt).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `
        <div class="saved-item" data-id="${record.id}">
          <strong>${record.fileName.replace(/\.pdf$/i, '')}</strong>
          <small>${createdAt}</small>
          <div class="saved-actions">
            <button type="button" data-action="open" data-id="${record.id}">Abrir</button>
            <button type="button" data-action="download" data-id="${record.id}">Descargar</button>
            <button type="button" data-action="print" data-id="${record.id}">Imprimir</button>
            <button type="button" data-action="delete" data-id="${record.id}">Eliminar</button>
          </div>
        </div>
      `;
    })
    .join('');
}

async function openDocument(id) {
  const savedForms = await getAvailableSignedForms();
  const selected = savedForms.find((item) => item.id === id);
  if (!selected) return;

  const newWindow = window.open('about:blank', '_blank');
  if (!newWindow) return;

  fetch(selected.pdf)
    .then((response) => response.blob())
    .then((blob) => {
      const pdfUrl = URL.createObjectURL(blob);
      newWindow.location.href = pdfUrl;
      newWindow.focus();
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    })
    .catch(() => {
      newWindow.close();
      alert('No se pudo abrir el formulario firmado. Intente descargarlo.');
    });
}

async function downloadDocument(id) {
  const savedForms = await getAvailableSignedForms();
  const selected = savedForms.find((item) => item.id === id);
  if (!selected) return;

  const link = document.createElement('a');
  link.href = selected.pdf;
  link.download = selected.fileName;
  link.click();
}

async function printDocument(id) {
  const savedForms = await getAvailableSignedForms();
  const selected = savedForms.find((item) => item.id === id);
  if (!selected) return;

  const printWindow = window.open('about:blank', '_blank');
  if (!printWindow) return;

  fetch(selected.pdf)
    .then((response) => response.blob())
    .then((blob) => {
      const pdfUrl = URL.createObjectURL(blob);
      printWindow.location.href = pdfUrl;
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
      }, 1000);
    })
    .catch(() => {
      printWindow.close();
      alert('No se pudo preparar el formulario para imprimir.');
    });
}

async function deleteDocument(id) {
  if (!requirePermission('consult', true)) return;
  const savedForms = await getAvailableSignedForms();
  const selected = savedForms.find((item) => item.id === id);
  if (!selected) return;
  if (!window.confirm(`¿Desea eliminar ${selected.fileName}?`)) return;

  try {
    const { error } = await supabaseClient.from('signed_forms').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    const remainingForms = savedForms.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingForms));
  }
  await renderSavedDocuments();
}

async function saveCurrentDocument() {
  if (!requirePermission('fill', true)) return;
  const data = getFormValues();
  const isAccepted = data.acepto === 'on';
  if (!isAccepted) {
    alert('Debe aceptar el consentimiento para guardar el documento.');
    return;
  }

  if (signaturePad.isEmpty()) {
    alert('Debe firmar el documento antes de guardar o descargar el PDF.');
    return;
  }

  const { pdfDataUrl, fileName } = await buildPdfAndDataUrl();
  await savePdfToStorage(pdfDataUrl, fileName);
  alert('El formulario firmado se guardó correctamente. Puede descargarlo desde el botón "Descargar PDF".');
}

function handleSavedActions(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === 'open') openDocument(id);
  if (action === 'download') downloadDocument(id);
  if (action === 'print') printDocument(id);
  if (action === 'delete') deleteDocument(id);
}

function triggerDownload(pdfDataUrl, fileName) {
  const link = document.createElement('a');
  link.href = pdfDataUrl;
  link.download = fileName;
  link.click();
}

function switchView(viewName) {
  if (!hasPermission(viewName)) {
    const firstAllowed = Object.keys(viewPanels).find((key) => hasPermission(key));
    if (firstAllowed && firstAllowed !== viewName) return switchView(firstAllowed);
    return;
  }
  menuTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  Object.entries(viewPanels).forEach(([key, panel]) => {
    panel.classList.toggle('hidden-view', key !== viewName);
    panel.classList.toggle('active-view', key === viewName);
  });

  if (viewName === 'fill') requestAnimationFrame(resizeSignatureCanvas);
}

function applyTemplateChanges() {
  if (!requirePermission('edit', true)) return;
  const title = editTitleInput.value.trim() || 'CONSENTIMIENTO INFORMADO';
  const responsable = editResponsableInput.value.trim() || 'Municipio de Rionegro';
  const municipio = editMunicipioInput.value.trim() || 'Rionegro';
  const institucion = editInstitucionInput.value.trim();
  const objetivo = editObjetivoInput.value.trim() || 'Objetivo no especificado';
  const visita = editVisitaInput.value.trim() || 'Visita familiar no especificada';
  const importancia = editImportanciaInput.value.trim() || 'Importancia no especificada';
  const confidencialidad = editConfidencialidadInput.value.trim() || 'Confidencialidad no especificada';
  const aceptacion = editAceptacionInput.value.trim() || 'Aceptación no especificada';

  const template = {
    title,
    responsable,
    municipio,
    institucion,
    objetivo,
    visita,
    importancia,
    confidencialidad,
    aceptacion
  };

  editTitleInput.value = title;
  editResponsableInput.value = responsable;
  editMunicipioInput.value = municipio;
  editInstitucionInput.value = institucion;
  editObjetivoInput.value = objetivo;
  editVisitaInput.value = visita;
  editImportanciaInput.value = importancia;
  editConfidencialidadInput.value = confidencialidad;
  editAceptacionInput.value = aceptacion;
  applyTemplateToForm(template);
  saveTemplate();

  alert('Los cambios del formulario se aplicaron correctamente.');
}

logoInput.addEventListener('change', (event) => {
  if (!requirePermission('edit', true)) {
    event.target.value = '';
    return;
  }
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    saveLogoToStorage(dataUrl);
  };
  reader.readAsDataURL(file);
});

savePdfButton.addEventListener('click', saveCurrentDocument);
downloadButton.addEventListener('click', async () => {
  if (!requirePermission('fill', true)) return;
  if (signaturePad.isEmpty()) {
    alert('Debe firmar el documento antes de descargar el PDF.');
    return;
  }

  const { pdfDataUrl, fileName } = await buildPdfAndDataUrl();
  triggerDownload(pdfDataUrl, fileName);
});
clearSignatureButton.addEventListener('click', () => signaturePad.clear());
window.addEventListener('resize', resizeSignatureCanvas);
clearFieldsButton.addEventListener('click', () => {
  if (!requirePermission('fill', true)) return;
  consentForm.querySelectorAll('input[type="text"], input[type="date"]').forEach((field) => {
    field.value = '';
  });
});
savedDocumentsContainer.addEventListener('click', handleSavedActions);
applyTemplateBtn.addEventListener('click', applyTemplateChanges);
saveTemplateButton.addEventListener('click', saveNamedTemplate);
updateTemplateButton.addEventListener('click', updateSelectedTemplate);
templateSelect.addEventListener('change', () => loadNamedTemplate(templateSelect.value));
editTemplateSelect.addEventListener('change', () => loadNamedTemplate(editTemplateSelect.value));
deleteTemplateButton.addEventListener('click', deleteSelectedTemplate);
saveDesignButton.addEventListener('click', savePdfDesign);
menuTabs.forEach((tab) => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});
loginForm.addEventListener('submit', handleLogin);
logoutButton.addEventListener('click', logout);

async function loadRolesAndUsers() {
  if (!hasPermission('users', true)) return;
  const { data: roles } = await supabaseClient.from('app_roles').select('id, name').order('name');
  newUserRole.innerHTML = (roles || []).map((role) => `<option value="${role.id}">${role.name}</option>`).join('');
  const { data: profiles } = await supabaseClient
    .from('app_profiles')
    .select('id, email, role_id, app_roles(name)')
    .order('created_at', { ascending: true });
  usersList.innerHTML = (profiles || []).map((profile) => `
    <div class="saved-item">
      <strong>${escapeHtml(profile.email)}</strong>
      <div class="user-management-row">
        <select data-user-role="${profile.id}">
          ${(roles || []).map((role) => `<option value="${role.id}" ${role.id === profile.role_id ? 'selected' : ''}>${escapeHtml(role.name)}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-secondary" data-user-action="role" data-user-id="${profile.id}">Guardar rol</button>
        <button type="button" class="btn btn-outline" data-user-action="delete" data-user-id="${profile.id}">${profile.id === currentUser?.id ? 'No revocar' : 'Revocar acceso'}</button>
      </div>
    </div>
  `).join('') || '<div class="empty-state">No hay usuarios registrados.</div>';

  const { data: roleRows } = await supabaseClient
    .from('app_roles')
    .select('id, name, description, app_role_permissions(permission_key, can_edit)')
    .order('name');
  rolesList.innerHTML = (roleRows || []).map((role) => {
    const activePermissions = (role.app_role_permissions || []).map((permission) => permission.permission_key).join(', ');
    return `
      <div class="saved-item">
        <strong>${escapeHtml(role.name)}</strong>
        <small>${escapeHtml(role.description || 'Sin descripción')}<br />Permisos: ${escapeHtml(activePermissions || 'Ninguno')}</small>
        <div class="saved-actions">
          <button type="button" data-role-action="edit" data-role-id="${role.id}">Editar</button>
          <button type="button" data-role-action="delete" data-role-id="${role.id}">Eliminar</button>
        </div>
      </div>
    `;
  }).join('') || '<div class="empty-state">No hay roles registrados.</div>';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function resetRoleForm() {
  roleForm.reset();
  editingRoleId.value = '';
  cancelRoleEditButton.classList.add('hidden-view');
}

function setRoleForm(role) {
  editingRoleId.value = role.id;
  roleNameInput.value = role.name;
  roleDescriptionInput.value = role.description || '';
  document.querySelectorAll('[data-role-permission]').forEach((input) => {
    input.checked = (role.app_role_permissions || []).some((item) => item.permission_key === input.dataset.rolePermission);
  });
  document.querySelectorAll('[data-role-edit]').forEach((input) => {
    input.checked = (role.app_role_permissions || []).some((item) => item.permission_key === input.dataset.roleEdit && item.can_edit);
  });
  cancelRoleEditButton.classList.remove('hidden-view');
  roleNameInput.focus();
}

async function saveRole(event) {
  event.preventDefault();
  if (!requirePermission('users', true)) return;
  const name = roleNameInput.value.trim();
  const description = roleDescriptionInput.value.trim();
  const roleId = editingRoleId.value;
  if (!name) return;

  let savedRoleId = roleId;
  const rolePayload = { name, description };
  const roleResult = roleId
    ? await supabaseClient.from('app_roles').update(rolePayload).eq('id', roleId).select('id').single()
    : await supabaseClient.from('app_roles').insert(rolePayload).select('id').single();
  if (roleResult.error) {
    userManagementMessage.textContent = `No se pudo guardar el rol: ${roleResult.error.message}`;
    return;
  }
  savedRoleId = roleResult.data.id;

  const selectedPermissions = [...document.querySelectorAll('[data-role-permission]:checked')].map((input) => ({
    role_id: savedRoleId,
    permission_key: input.dataset.rolePermission,
    can_edit: Boolean(document.querySelector(`[data-role-edit="${input.dataset.rolePermission}"]`)?.checked)
  }));
  const { error: deletePermissionsError } = await supabaseClient
    .from('app_role_permissions').delete().eq('role_id', savedRoleId);
  if (deletePermissionsError) {
    userManagementMessage.textContent = `No se pudieron actualizar los permisos: ${deletePermissionsError.message}`;
    return;
  }
  if (selectedPermissions.length) {
    const { error: permissionError } = await supabaseClient.from('app_role_permissions').insert(selectedPermissions);
    if (permissionError) {
      userManagementMessage.textContent = `No se pudieron guardar los permisos: ${permissionError.message}`;
      return;
    }
  }
  userManagementMessage.textContent = 'Rol y permisos guardados correctamente.';
  resetRoleForm();
  await loadRolesAndUsers();
}

async function handleUserAction(event) {
  const button = event.target.closest('button[data-user-action]');
  if (!button || !requirePermission('users', true)) return;
  const userId = button.dataset.userId;
  if (button.dataset.userAction === 'role') {
    const roleId = usersList.querySelector(`[data-user-role="${userId}"]`).value;
    const { error } = await supabaseClient.from('app_profiles').update({ role_id: roleId }).eq('id', userId);
    userManagementMessage.textContent = error ? `No se pudo actualizar el rol: ${error.message}` : 'Rol del usuario actualizado.';
  }
  if (button.dataset.userAction === 'delete' && userId !== currentUser?.id) {
    if (!window.confirm('¿Desea revocar el acceso de este usuario?')) return;
    const { error } = await supabaseClient.from('app_profiles').delete().eq('id', userId);
    userManagementMessage.textContent = error ? `No se pudo revocar el acceso: ${error.message}` : 'Acceso del usuario revocado.';
  }
  await loadRolesAndUsers();
}

async function handleRoleAction(event) {
  const button = event.target.closest('button[data-role-action]');
  if (!button || !requirePermission('users', true)) return;
  const roleId = button.dataset.roleId;
  const { data: role, error } = await supabaseClient.from('app_roles').select('id, name, description, app_role_permissions(permission_key, can_edit)').eq('id', roleId).single();
  if (error) {
    userManagementMessage.textContent = `No se pudo cargar el rol: ${error.message}`;
    return;
  }
  if (button.dataset.roleAction === 'edit') {
    setRoleForm(role);
    return;
  }
  if (!window.confirm(`¿Desea eliminar el rol "${role.name}"? Los usuarios asignados deben tener otro rol.`)) return;
  const { error: deleteError } = await supabaseClient.from('app_roles').delete().eq('id', roleId);
  userManagementMessage.textContent = deleteError ? `No se pudo eliminar el rol: ${deleteError.message}` : 'Rol eliminado.';
  await loadRolesAndUsers();
}

createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!requirePermission('users', true)) return;
  userManagementMessage.textContent = '';
  const { data, error } = await supabaseClient.auth.signUp({
    email: newUserEmail.value.trim().toLowerCase(),
    password: newUserPassword.value
  });
  if (error || !data.user) {
    userManagementMessage.textContent = error?.message || 'No se pudo crear el usuario.';
    return;
  }
  const { error: profileError } = await supabaseClient.from('app_profiles').upsert({
    id: data.user.id,
    email: newUserEmail.value.trim().toLowerCase(),
    role_id: newUserRole.value
  });
  if (profileError) {
    userManagementMessage.textContent = `Usuario creado, pero no se pudo asignar el rol: ${profileError.message}`;
    return;
  }
  createUserForm.reset();
  userManagementMessage.textContent = 'Usuario creado y rol asignado correctamente.';
  await loadRolesAndUsers();
});

roleForm.addEventListener('submit', saveRole);
cancelRoleEditButton.addEventListener('click', resetRoleForm);
usersList.addEventListener('click', handleUserAction);
rolesList.addEventListener('click', handleRoleAction);

async function bootstrap() {
  loadStoredTemplate();
  renderTemplateOptions();
  loadPdfDesign();
  loadStoredLogo();
  renderSavedDocuments();
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) await initializeAccess(data.session);
  else setAuthenticated(false);
}

bootstrap();
