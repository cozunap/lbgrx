// Cloudflare Pages Function backend endpoint for handling quote requests
export async function onRequestPost({ request, env }) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let fullName = '', email = '', company = '', phone = '', message = '';

    if (contentType.includes('application/json')) {
      const data = await request.json();
      fullName = (data.fullName || data.name || '').trim();
      email = (data.email || '').trim();
      company = (data.company || '').trim();
      phone = (data.phone || '').trim();
      message = (data.message || data.projectDetails || '').trim();
    } else {
      const formData = await request.formData();
      fullName = (formData.get('form_fields[field_0cd2390]') || formData.get('name') || formData.get('fullName') || '').trim();
      email = (formData.get('form_fields[email]') || formData.get('email') || '').trim();
      company = (formData.get('form_fields[name]') || formData.get('company') || '').trim();
      phone = (formData.get('form_fields[field_e16ab7a]') || formData.get('phone') || '').trim();
      message = (formData.get('form_fields[message]') || formData.get('message') || '').trim();
    }

    if (!fullName || !email || !message) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Please provide full name, email, and project details.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const lead = {
      id: crypto.randomUUID(),
      fullName, email, company, phone, message,
      createdAt: new Date().toISOString()
    };

    if (env && env.LEADS_KV) {
      await env.LEADS_KV.put(`lead:${lead.id}`, JSON.stringify(lead));
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Thank you! Your quote request has been received. We will get back to you shortly.',
      leadId: lead.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Server error processing request. Please call us directly at 212-246-2600.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
