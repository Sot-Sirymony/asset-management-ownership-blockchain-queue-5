export const uploadImages = async (fileName) => {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/files`,
    {
      method: "POST",
      body: fileName,
    },
    {
      next: {
        tag: ["uploadImages"],
      },
    }
  );
  const text = await res.text();
  if (!text || text.trim() === "") {
    return { ok: res.ok, status: res.status };
  }
  try {
    const payload = JSON.parse(text);
    return payload;
  } catch {
    return { ok: false, status: res.status, message: text || "Invalid response" };
  }
};

  // export const getFileName = async (fileName) => {
  //   const res = await fetch(
  //     `${process.env.BASE_URL_V2}/v1/file?fileName=${fileName}`,
  //     {
  //       method: "GET"
  //     },
  //     {
  //       next: {
  //         tag: ["getFileName"],
  //       },
  //     }
  //   );
  //   const data = await res.json();
  //   return data;
  // };