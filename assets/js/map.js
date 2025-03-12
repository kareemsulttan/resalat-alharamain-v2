class MapManager {
    constructor(type="hadeeth") {
        this.mapContainer = document.getElementById('map');
        this.width = this.mapContainer.clientWidth;
        this.height = 700;
        this.svg = null;
        this.projection = null;
        this.path = null;
        this.zoom = null;
        this.baseGroup = null;
        this.labelGroup = null;
        this.bubbleGroup = null;
        this.currentScale = 1;

        // Store radius scale for reuse during zoom
        this.radiusScale = null;

        // Add zoom controls configuration
        this.zoomExtent = [1, 8];
        this.currentTransform = d3.zoomIdentity;
        
        this.labels = [
            { name: "المحيط الأطلسي", coords: [-30, 30], type: "ocean" },
            { name: "المحيط الهندي", coords: [80, -10], type: "ocean" },
            { name: "المحيط الهادئ", coords: [160, 0], type: "ocean" },
            { name: "آسيا", coords: [90, 45], type: "continent" },
            { name: "أفريقيا", coords: [20, 0], type: "continent" },
            { name: "أوروبا", coords: [15, 50], type: "continent" },
            { name: "أمريكا الشمالية", coords: [-100, 40], type: "continent" },
            { name: "أمريكا الجنوبية", coords: [-60, -20], type: "continent" },
            { name: "أستراليا", coords: [135, -25], type: "continent" }
        ];
        this.type = type;
    }

    async initialize() {
        try {
            // Create base SVG
            this.svg = d3.select(this.mapContainer)
                .append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("viewBox", [0, 0, this.width, this.height])
                .style("cursor", "grab");
    
            // Background water
            this.svg.append("rect")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("fill", "#a8d5e5");
    
            // Create main container for all map elements
            this.mainGroup = this.svg.append("g")
                .attr("class", "main-group");
    
            // Create layers with proper order
            this.baseGroup = this.mainGroup.append("g").attr("class", "base-group");
            this.labelGroup = this.mainGroup.append("g").attr("class", "label-group");
            this.bubbleGroup = this.mainGroup.append("g").attr("class", "bubble-group");
    
            // Initialize zoom behavior
            this.zoom = d3.zoom()
                .scaleExtent([1, 8])
                .translateExtent([[0, 0], [this.width, this.height]])
                .on("start", () => this.svg.style("cursor", "grabbing"))
                .on("end", () => this.svg.style("cursor", "grab"))
                .on("zoom", (event) => this.handleZoom(event));
    
            // Apply zoom behavior
            this.svg.call(this.zoom);
    
            // Create tooltip
            this.tooltip = d3.select(this.mapContainer)
                .append("div")
                .attr("class", "map-tooltip")
                .style("opacity", 0);
    
                this.projection = d3.geoMercator()
                .scale(170)
                .center([0, 25]) // Changed from [45, 25] to [0, 25]
                .translate([this.width / 2, this.height / 2]);

            // Enable wrapping around the antimeridian (date line)
            this.path = d3.geoPath()
                .projection(this.projection)
                .pointRadius(2);

            // Create clip path for wrapping
            this.svg.append("defs")
                .append("clipPath")
                .attr("id", "map-clip")
                .append("rect")
                .attr("width", this.width)
                .attr("height", this.height);

            // Apply clip path to main group
            this.mainGroup.attr("clip-path", "url(#map-clip)");
    
            // Add zoom controls
            this.addZoomControls();
    
            // Load and render data
            const [worldData, analyticsData] = await Promise.all([
                d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'),
                this.fetchAnalyticsData()
            ]);
    
            // Draw base map
            this.baseGroup.selectAll("path")
                .data(worldData.features)
                .join("path")
                .attr("d", this.path)
                .attr("class", "country")
                .style("fill", "#c8e6c9")
                .style("stroke", "#81c784")
                .style("stroke-width", 0.5);
    
            // Add labels and bubbles
            this.addLabels();
            await this.updateBubbles(analyticsData);
    
            // Set up auto-refresh
            this.startAutoRefresh();
    
        } catch (error) {
            console.error('Failed to initialize map:', error);
            this.handleError(error);
        }
    }
    addZoomControls() {
        // Create controls container
        const controls = this.svg.append("g")
            .attr("class", "zoom-controls")
            .attr("transform", `translate(20, 20)`);

        // Add zoom in button
        const zoomIn = controls.append("g")
            .attr("class", "zoom-in")
            .style("cursor", "pointer");

        zoomIn.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 30)
            .attr("height", 30)
            .attr("rx", 4)
            .attr("fill", "white")
            .attr("stroke", "#ccc");

        zoomIn.append("text")
            .attr("x", 15)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size", "20px")
            .style("pointer-events", "none")
            .text("+");

        // Add zoom out button
        const zoomOut = controls.append("g")
            .attr("class", "zoom-out")
            .attr("transform", "translate(0, 40)")
            .style("cursor", "pointer");

        zoomOut.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 30)
            .attr("height", 30)
            .attr("rx", 4)
            .attr("fill", "white")
            .attr("stroke", "#ccc");

        zoomOut.append("text")
            .attr("x", 15)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size", "20px")
            .style("pointer-events", "none")
            .text("−");

        // Add reset button
        const reset = controls.append("g")
            .attr("class", "zoom-reset")
            .attr("transform", "translate(0, 80)")
            .style("cursor", "pointer");

        reset.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 30)
            .attr("height", 30)
            .attr("rx", 4)
            .attr("fill", "white")
            .attr("stroke", "#ccc");

        reset.append("text")
            .attr("x", 15)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size", "16px")
            .style("pointer-events", "none")
            .text("R");

        // Add event listeners
        zoomIn.on("click", () => {
            this.svg.transition()
                .duration(300)
                .call(this.zoom.scaleBy, 1.5);
        });

        zoomOut.on("click", () => {
            this.svg.transition()
                .duration(300)
                .call(this.zoom.scaleBy, 0.67);
        });

        reset.on("click", () => {
            this.svg.transition()
                .duration(300)
                .call(this.zoom.transform, d3.zoomIdentity);
        });
    }

    handleZoom(event) {
        // Store current transform
        this.currentScale = event.transform.k;
        
        // Apply transform to main group
        this.mainGroup.attr("transform", event.transform);
        
        // Update bubble sizes based on zoom level
        if (this.radiusScale) {
            this.bubbleGroup.selectAll("circle")
                .attr("r", d => this.radiusScale(d.views) / Math.sqrt(this.currentScale))
                .attr("stroke-width", 1.5 / Math.sqrt(this.currentScale));
        }

        // Ensure zoom controls stay in place
        this.svg.select(".zoom-controls")
            .attr("transform", `translate(20, 20)`);
    }

    handleZoomButton(factor) {
        this.svg.transition()
            .duration(300)
            .call(this.zoom.scaleBy, factor);
    }

    addLabels() {
        this.labelGroup.selectAll(".map-label")
            .data(this.labels)
            .enter()
            .append("text")
            .attr("class", d => `map-label ${d.type}-label`)
            .attr("x", d => this.projection(d.coords)[0])
            .attr("y", d => this.projection(d.coords)[1])
            .attr("text-anchor", "middle")
            .text(d => d.name);
    }

    async updateBubbles(data) {
        if (!data || !data.length) return;

        // Update radius scale
        const maxViews = d3.max(data, d => d.views);
        this.radiusScale = d3.scaleSqrt()
            .domain([0, maxViews])
            .range([5, 40]);

        // Color scale
        const colorScale = d3.scaleOrdinal()
            .domain(data.map(d => d.country))
            .range([
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
                '#FFD93D', '#6C5B7B', '#C06C84', '#F8B195',
                '#2E94B9', '#FFA07A', '#98DFD6', '#FF9EAA',
                '#FFBE0B', '#4DA167', '#845EC2', '#D65DB1'
            ]);

        // Update bubbles
        const bubbles = this.bubbleGroup.selectAll(".data-bubble")
            .data(data);

        // Remove old bubbles
        bubbles.exit().remove();

        // Update existing and add new bubbles
        const allBubbles = bubbles.enter()
            .append("circle")
            .attr("class", "data-bubble")
            .merge(bubbles)
            .attr("cx", d => {
                const point = this.projection([d.longitude, d.latitude]);
                return point ? point[0] : 0;
            })
            .attr("cy", d => {
                const point = this.projection([d.longitude, d.latitude]);
                return point ? point[1] : 0;
            })
            .attr("r", d => this.radiusScale(d.views) / Math.sqrt(this.currentScale))
            .style("fill", d => colorScale(d.country))
            .style("opacity", 0.8)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5 / Math.sqrt(this.currentScale))
            .style("cursor", "pointer");

        // Add event listeners
        allBubbles
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget)
                    .style("opacity", 1)
                    .attr("stroke-width", (2 / Math.sqrt(this.currentScale)));
                this.showTooltip(event, d);
            })
            .on("mousemove", (event, d) => {
                this.showTooltip(event, d);
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget)
                    .style("opacity", 0.8)
                    .attr("stroke-width", (1.5 / Math.sqrt(this.currentScale)));
                this.tooltip.style("opacity", 0);
            });
    }

    async fetchAnalyticsData() {
        try {
            const response = await fetch(`/api/map-data?type=${this.type}`);
            if (!response.ok) throw new Error('Failed to fetch analytics data');
            const data = await response.json();
            console.log('Fetched data:', data); // Debug log
            return data;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }

    
    showTooltip(event, d) {
        const rect = this.mapContainer.getBoundingClientRect();
        const x = event.clientX - rect.left; // x position within the element
        const y = event.clientY - rect.top;  // y position within the element

        this.tooltip
            .style("opacity", 1)
            .html(`
                <div dir="rtl">
                    <div class="country-name">${d.country}</div>
                    <div class="views-count">الزيارات: ${d.views.toLocaleString()}</div>
                </div>
            `)
            .style("left", `${x + 10}px`)
            .style("top", `${y - 10}px`);
    }

    hideTooltip() {
        d3.select("#map-tooltip")
            .classed("hidden", true);
    }

    startAutoRefresh() {
        setInterval(async () => {
            const data = await this.fetchAnalyticsData();
            this.updateBubbles(data);
        }, 60000);
    }

    handleError(error) {
        console.error('Map error:', error);
        this.mapContainer.innerHTML = `
            <div class="flex items-center justify-center h-full bg-gray-100 rounded-lg p-4">
                <p class="text-gray-500 text-center">عذراً، حدث خطأ في تحميل البيانات</p>
            </div>
        `;
    }

    // Handle window resize
    handleResize() {
        this.width = this.mapContainer.clientWidth;
        this.svg
            .attr("width", this.width)
            .attr("height", this.height);
        
        this.projection
            .translate([this.width / 2, this.height / 2]);
        
        // Update map paths and bubbles
        this.g.selectAll("path")
            .attr("d", this.path);
        
        this.g.selectAll("circle")
            .attr("cx", d => this.projection([d.longitude, d.latitude])[0])
            .attr("cy", d => this.projection([d.longitude, d.latitude])[1]);
    }
}