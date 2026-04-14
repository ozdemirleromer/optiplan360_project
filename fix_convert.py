f = r'C:\optiplan360_project\frontend\src\services\crmService.ts'
with open(f, 'r', encoding='utf-8') as fp:
    content = fp.read()

old = '    return apiRequest(/crm/quotes//convert-to-order, { method: `POST` });'
new = '    return apiRequest<{ ok: boolean; message: string; order_id?: string; order_number?: string }>(`/crm/quotes/${id}/convert-to-order`, { method: "POST" });'

if old in content:
    content = content.replace(old, new, 1)
    with open(f, 'w', encoding='utf-8') as fp:
        fp.write(content)
    print('Fixed!')
else:
    idx = content.find('convert-to-order')
    if idx >= 0:
        print('OLD not found, context:', repr(content[idx-80:idx+120]))
    else:
        print('convert-to-order not found at all')
