export default function ImagePreview({ src, loading, loadingMessage }: { src?: string; loading?: boolean; loadingMessage?: string }) {
    return (
        <div className="mx-auto" style={{ width: 400, height: 400 }}>
            {src && !loading ? (
                <img
                    src={src}
                    alt="Social post preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover", border: "1px solid #d4d0c8" }}
                />
            ) : (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "1px solid #d4d0c8",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                    }}
                    className="text-muted text-sm"
                >
                    {loading ? (
                        <>
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    border: "2px solid #d4d0c8",
                                    borderTopColor: "#6b6760",
                                    animation: "spin 0.8s linear infinite",
                                }}
                            />
                            {loadingMessage && <span>{loadingMessage}</span>}
                        </>
                    ) : (
                        "No image yet"
                    )}
                </div>
            )}
        </div>
    )
}
