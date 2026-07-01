using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// DraggableSegment - Represents one audio feature segment in the Kaleidoscope Quest spectrogram.
/// Assign clusterType in Inspector ("BatFM", "BirdTrill", "FrogPeep", "MammalHowl", "Noise").
/// Drag to correct ClusterZone for scoring (exactly as required for WA Kaleidoscope-style clustering).
/// </summary>
public class DraggableSegment : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
{
    public string clusterType;          // e.g. "BatFM", "BirdTrill"
    public string displayLabel = "Feature 0x3A";
    public AudioClip associatedClip;    // Play on drag or successful drop

    private RectTransform rectTransform;
    private CanvasGroup canvasGroup;
    private Vector2 originalPosition;
    private Transform originalParent;

    public SpectrogramPuzzle puzzle;    // Set by the puzzle when spawning

    void Awake()
    {
        rectTransform = GetComponent<RectTransform>();
        canvasGroup = GetComponent<CanvasGroup>();
        if (canvasGroup == null) canvasGroup = gameObject.AddComponent<CanvasGroup>();
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        originalPosition = rectTransform.anchoredPosition;
        originalParent = transform.parent;
        transform.SetParent(transform.root); // Bring to top
        canvasGroup.alpha = 0.7f;
        canvasGroup.blocksRaycasts = false;

        // Play the feature sound (WA authenticity — user hears what they're clustering)
        if (associatedClip != null && AudioManager.Instance != null)
        {
            // In real: route through AudioManager with proper spatial or UI mix
            // AudioManager.Instance.PlayOneShotUI(associatedClip);
        }
    }

    public void OnDrag(PointerEventData eventData)
    {
        rectTransform.anchoredPosition += eventData.delta / (GetComponentInParent<Canvas>()?.scaleFactor ?? 1f);
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        canvasGroup.alpha = 1f;
        canvasGroup.blocksRaycasts = true;

        // Let the drop zone (ClusterZone) handle the actual scoring and snap
        // If not dropped on a valid zone, snap back
        if (transform.parent == transform.root)
        {
            transform.SetParent(originalParent);
            rectTransform.anchoredPosition = originalPosition;
        }
    }

    public void ReturnToOrigin()
    {
        transform.SetParent(originalParent);
        rectTransform.anchoredPosition = originalPosition;
    }
}
