// Foto de celular tem 3–6 MB e o envio aceita 11 MB no total: cada foto é
// reduzida no navegador (lado maior 1600 px, JPEG 0,8) antes de subir, ficando
// com ~300 KB. Só roda no cliente (usa canvas).

const LADO_MAX = 1600;

export async function reduzirFoto(arquivo: File): Promise<File> {
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    canvas.getContext("2d")!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    imagem.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.8));
    if (!blob) return arquivo;
    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    // Formato que o navegador não decodifica (ex.: HEIC em alguns aparelhos):
    // segue o original e o servidor confere o tamanho.
    return arquivo;
  }
}
