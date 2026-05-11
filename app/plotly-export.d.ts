declare module "plotly.js-dist-min" {
    const Plotly: {
        toImage: (
            graphDiv: HTMLElement,
            options: {
                format: "png" | "jpeg" | "svg" | "webp"
                width?: number
                height?: number
                scale?: number
            }
        ) => Promise<string>
    }

    export default Plotly
}
