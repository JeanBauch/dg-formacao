---
status: Aceito
origem: docs/requisitos/requisitos.md, seção 9.2
---

# PDFs e materiais em object storage com URL assinada

PDFs e materiais complementares ficam num object storage, com os metadados no banco e a leitura por URL assinada de validade curta. Na v2.3, o storage é o Cloudflare R2, e o acesso passa pela rota estável `/media/{id}` (RF-APR-05).

## Consequências

- Cada documento tem `source = storage` ou `external_url`. O Google Drive fica só como contingência.
- A URL assinada tem TTL curto, e o visualizador tem fallback para celular.
