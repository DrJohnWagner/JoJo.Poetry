import Image from "next/image"

export default function ImagePreview({ src }: { src?: string }) {
    return (
        <div className="mx-auto" style={{ width: 400, height: 400 }}>
            {src ? (
                <Image
                    src={src}
                    alt="Social post preview"
                    width={400}
                    height={400}
                    unoptimized
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        border: "1px solid #d4d0c8",
                    }}
                />
            ) : (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "1px solid #d4d0c8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    className="text-sm text-muted"
                >
                    No image yet
                </div>
            )}
        </div>
    )
}
