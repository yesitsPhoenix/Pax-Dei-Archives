let mouseTooltip = document.getElementById("mouse-tooltip");

if (!mouseTooltip) {
    mouseTooltip = document.createElement("div");
    mouseTooltip.id = "mouse-tooltip";
    Object.assign(mouseTooltip.style, {
        position: "fixed",
        display: "none",
        pointerEvents: "none",
        zIndex: "9999",
        padding: "4px 8px",
        backgroundColor: "#030712",
        color: "white",
        fontSize: "12px",
        borderRadius: "4px",
        border: "1px solid #72e0cc",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
    });
    document.body.appendChild(mouseTooltip);
}

export function enableSignTooltip() {
    document.addEventListener("mouseover", e => {
        const img = e.target.closest("img[data-sign]");
        if (!img) return;

        const signName = img.dataset.sign
            .split('_')
            .slice(1)
            .join(' ')
            .replace(/_/g, ' ');

        mouseTooltip.textContent = signName;
        mouseTooltip.style.display = "block";
    });

    document.addEventListener("mousemove", e => {
        if (mouseTooltip.style.display === "none") return;
        mouseTooltip.style.left = `${e.clientX + 12}px`;
        mouseTooltip.style.top = `${e.clientY + 12}px`;
    });

    document.addEventListener("mouseout", e => {
        if (e.target.closest("img[data-sign]")) {
            mouseTooltip.style.display = "none";
        }
    });
}

export { mouseTooltip };